import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSession, isAllowedCase } from '../src/session.mjs';
import { buildOptions } from '../src/options.mjs';
import { newProfile, saveProfile } from '../src/profile.mjs';
import { loadCase } from './fixtures.mjs';

const ID = 'daniel-emily-johnson';
const log = { log() {}, error() {} };

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1;
    this.sent = [];
    this.closed = false;
  }
  send(m) {
    this.sent.push(m);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.emit('close');
  }
  json() {
    return this.sent.map((m) => JSON.parse(m));
  }
}

function fakeSource({ fail = false } = {}) {
  const { fh, personaMd } = loadCase(ID);
  return {
    async getPart(caseId, part) {
      if (fail) throw new Error('mcp down');
      if (part === 'financial-health') return fh;
      if (part === 'persona') return personaMd;
      throw new Error(`unexpected part ${part}`);
    },
  };
}

async function tmp(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function until(cond, ms = 2000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 5));
  }
}

async function start({ source = fakeSource(), profilesDir, transcriptsDir } = {}) {
  const browser = new FakeSocket();
  const upstream = new FakeSocket();
  profilesDir ??= await tmp('profiles-');
  transcriptsDir ??= await tmp('transcripts-');
  await createSession({ browser, upstream, caseId: ID, source, profilesDir, transcriptsDir, log });
  upstream.sent.length = 0; // drop the server's own initial session.update (tested separately)
  return { browser, upstream, profilesDir, transcriptsDir };
}

const pageUpdate = {
  type: 'session.update',
  session: {
    type: 'realtime',
    instructions: 'from the page, must be replaced',
    tools: [{ type: 'function', name: 'evil' }],
    audio: { input: { format: { type: 'audio/pcm', rate: 24000 } }, output: { format: { type: 'audio/pcm', rate: 24000 } } },
  },
};

function functionCallDone(name, args, callId = 'call_1') {
  return JSON.stringify({
    type: 'response.done',
    response: { id: 'resp_1', output: [{ type: 'function_call', name, call_id: callId, arguments: JSON.stringify(args) }] },
  });
}

function options() {
  const { fh, personaMd } = loadCase(ID);
  return buildOptions(fh, personaMd);
}

test('injects instructions and tools into page session.update', async () => {
  const { browser, upstream } = await start();
  browser.emit('message', Buffer.from(JSON.stringify(pageUpdate)));
  await until(() => upstream.sent.length === 1);
  const ev = upstream.json()[0];
  assert.equal(ev.type, 'session.update');
  assert.match(ev.session.instructions, /You are Sherpy/);
  assert.match(ev.session.instructions, /PHASE ONE/);
  assert.deepEqual(ev.session.tools.map((t) => t.name), ['save_answer', 'get_plan_section']);
  assert.equal(ev.session.tool_choice, 'auto');
  assert.deepEqual(ev.session.audio, { ...pageUpdate.session.audio, output: { ...pageUpdate.session.audio.output, voice: 'Charon' } });

  // Everything else passes through untouched.
  const append = JSON.stringify({ type: 'input_audio_buffer.append', audio: 'AAAA' });
  browser.emit('message', Buffer.from(append));
  await until(() => upstream.sent.length === 2);
  assert.equal(upstream.sent[1], append);
});

test('queues page messages until upstream is open', async () => {
  const browser = new FakeSocket();
  const upstream = new FakeSocket();
  upstream.readyState = 0;
  await createSession({
    browser, upstream, caseId: ID, source: fakeSource(),
    profilesDir: await tmp('profiles-'), transcriptsDir: await tmp('transcripts-'), log,
  });
  browser.emit('message', Buffer.from(JSON.stringify(pageUpdate)));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(upstream.sent.length, 0);
  upstream.readyState = 1;
  upstream.emit('open');
  await until(() => upstream.sent.length >= 1);
  assert.equal(upstream.json()[0].session.tool_choice, 'auto');
});

test('answers a save_answer function call with function_call_output then response.create', async () => {
  const { browser, upstream, profilesDir } = await start();
  const done = functionCallDone('save_answer', { question: 'present', person: 'household', value: 'Daniel, Emily' });
  upstream.emit('message', Buffer.from(done));
  await until(() => upstream.sent.length >= 2);
  const [item, create] = upstream.json();
  assert.equal(item.type, 'conversation.item.create');
  assert.equal(item.item.type, 'function_call_output');
  assert.equal(item.item.call_id, 'call_1');
  const output = JSON.parse(item.item.output);
  assert.equal(output.ok, true);
  assert.equal(output.phase1Complete, false);
  assert.equal(create.type, 'response.create');
  // The upstream event itself is relayed to the page.
  assert.equal(browser.sent[0], done);
  const onDisk = JSON.parse(await fs.readFile(path.join(profilesDir, `${ID}.json`), 'utf8'));
  assert.deepEqual(onDisk.present, ['Daniel', 'Emily']);
});

test('does not send a second session.update after phase 1 completes', async () => {
  const opts = options();
  const profilesDir = await tmp('profiles-');
  const p = newProfile(ID, opts.present);
  p.present = [...opts.present];
  for (const n of opts.present) p.people[n] = { risk: 'moderate', style: 'analytical' };
  p.main_goal.agreed = opts.main_goal[0].value;
  p.top_worry.agreed = opts.top_worry[0];
  await saveProfile(profilesDir, p);

  const { upstream } = await start({ profilesDir });
  upstream.emit('message', Buffer.from(functionCallDone('save_answer', { question: 'detail_level', person: 'household', value: 'medium' })));
  await until(() => upstream.sent.length >= 2);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(upstream.json().map((e) => e.type), ['conversation.item.create', 'response.create']);
  assert.equal(JSON.parse(upstream.json()[0].item.output).phase1Complete, true);

  // ctx.profile was updated: a later save is validated against the completed profile and still works.
  upstream.emit('message', Buffer.from(functionCallDone('save_answer', { question: 'detail_level', person: 'household', value: 'bogus' }, 'call_2')));
  await until(() => upstream.sent.length >= 4);
  const out = JSON.parse(upstream.json()[2].item.output);
  assert.equal(out.ok, false);
  assert.deepEqual(out.allowed, ['low', 'medium', 'high']);
  assert.ok(!upstream.json().some((e) => e.type === 'session.update'));
});

test('incomplete profile exposes both tools', async () => {
  const { browser, upstream } = await start();
  browser.emit('message', Buffer.from(JSON.stringify(pageUpdate)));
  await until(() => upstream.sent.length === 1);
  const ev = upstream.json()[0];
  assert.deepEqual(ev.session.tools.map((t) => t.name), ['save_answer', 'get_plan_section']);
  assert.match(ev.session.instructions, /PHASE ONE/);
  assert.match(ev.session.instructions, /act as their advisor/);
});

test('starts in phase 2 when profile is complete', async () => {
  const opts = options();
  const profilesDir = await tmp('profiles-');
  const p = newProfile(ID, opts.present);
  p.present = [...opts.present];
  for (const n of opts.present) p.people[n] = { risk: 'growth', style: 'emotional' };
  p.main_goal.agreed = opts.main_goal[0].value;
  p.top_worry.agreed = opts.top_worry[0];
  p.detail_level = 'high';
  p.phase1Complete = true;
  await saveProfile(profilesDir, p);

  const { browser, upstream } = await start({ profilesDir });
  browser.emit('message', Buffer.from(JSON.stringify(pageUpdate)));
  await until(() => upstream.sent.length === 1);
  const ev = upstream.json()[0];
  assert.match(ev.session.instructions, /PHASE TWO/);
  assert.deepEqual(ev.session.tools.map((t) => t.name), ['get_plan_section']);
});

test('writes assistant transcript lines', async () => {
  const { upstream, transcriptsDir } = await start();
  // Gemini: only deltas, then response.done (no transcript .done event).
  for (const delta of ['Hi, I am ', 'Sherpy.']) {
    upstream.emit('message', Buffer.from(JSON.stringify({ type: 'response.output_audio_transcript.delta', response_id: 'r1', delta })));
  }
  upstream.emit('message', Buffer.from(JSON.stringify({ type: 'response.done', response: { id: 'r1', output: [] } })));
  // OpenAI: deltas followed by a .done with the full transcript; written once.
  upstream.emit('message', Buffer.from(JSON.stringify({ type: 'response.output_audio_transcript.delta', response_id: 'r2', delta: 'Wel' })));
  upstream.emit('message', Buffer.from(JSON.stringify({ type: 'response.output_audio_transcript.done', response_id: 'r2', transcript: 'Welcome back.' })));
  upstream.emit('message', Buffer.from(JSON.stringify({ type: 'response.done', response: { id: 'r2', output: [] } })));
  upstream.emit('message', Buffer.from(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Hello there' })));

  let lines = [];
  const read = async () => {
    const files = await fs.readdir(transcriptsDir).catch(() => []);
    if (files.length !== 1) return [];
    const text = await fs.readFile(path.join(transcriptsDir, files[0]), 'utf8');
    return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  };
  const end = Date.now() + 2000;
  while (lines.length < 3 && Date.now() < end) {
    lines = await read();
    await new Promise((r) => setTimeout(r, 10));
  }
  const files = await fs.readdir(transcriptsDir);
  assert.equal(files.length, 1);
  assert.ok(files[0].startsWith(`${ID}-`) && files[0].endsWith('.jsonl'));
  assert.deepEqual(lines.map(({ role, text }) => ({ role, text })), [
    { role: 'assistant', text: 'Hi, I am Sherpy.' },
    { role: 'assistant', text: 'Welcome back.' },
    { role: 'user', text: 'Hello there' },
  ]);
  for (const l of lines) assert.equal(typeof l.t, 'string');
});

test('closes upstream when browser closes', async () => {
  const { browser, upstream } = await start();
  browser.close();
  assert.equal(upstream.closed, true);
});

test('closes browser when upstream closes', async () => {
  const { browser, upstream } = await start();
  upstream.close();
  assert.equal(browser.closed, true);
});

test('sends plan_unavailable and closes when case data fails', async () => {
  const { browser, upstream } = await start({ source: fakeSource({ fail: true }) });
  assert.deepEqual(browser.json(), [{ type: 'error', error: { message: 'plan_unavailable' } }]);
  assert.equal(browser.closed, true);
  assert.equal(upstream.closed, true);
});

test('drops page conversation.item.create', async () => {
  const { browser, upstream } = await start();
  browser.emit('message', Buffer.from(JSON.stringify({
    type: 'conversation.item.create',
    item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'evil' }] },
  })));
  browser.emit('message', Buffer.from(JSON.stringify({
    type: 'conversation.item.create',
    item: { type: 'function_call_output', call_id: 'x', output: '{"ok":true}' },
  })));
  browser.emit('message', Buffer.from('{not json'));
  browser.emit('message', Buffer.from(JSON.stringify({ type: 'input_audio_buffer.commit', extra: 'evil' })));
  await until(() => upstream.sent.length === 1);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(upstream.json(), [{ type: 'input_audio_buffer.commit' }]);
});

test('strips response.create to bare', async () => {
  const { browser, upstream } = await start();
  browser.emit('message', Buffer.from(JSON.stringify({
    type: 'response.create',
    response: { instructions: 'evil', tools: [{ type: 'function', name: 'evil' }] },
  })));
  browser.emit('message', Buffer.from(JSON.stringify({
    type: 'conversation.item.truncate', item_id: 'i1', content_index: 0, audio_end_ms: 1200, evil: 'x',
  })));
  await until(() => upstream.sent.length === 2);
  assert.deepEqual(upstream.json(), [
    { type: 'response.create' },
    { type: 'conversation.item.truncate', item_id: 'i1', content_index: 0, audio_end_ms: 1200 },
  ]);
});

test('escaped session.update still gets our instructions', async () => {
  const { browser, upstream } = await start();
  // "session.update" written with a JSON escape, so a raw substring check would miss it.
  const raw = JSON.stringify({ ...pageUpdate, session: { ...pageUpdate.session, tool_choice: 'none', model: 'evil' } })
    .replace('"session.update"', '"session\\u002eupdate"');
  assert.ok(!raw.includes('"session.update"'));
  browser.emit('message', Buffer.from(raw));
  await until(() => upstream.sent.length === 1);
  assert.ok(!upstream.sent[0].includes('evil'));
  const ev = upstream.json()[0];
  assert.equal(ev.type, 'session.update');
  assert.match(ev.session.instructions, /You are Sherpy/);
  assert.deepEqual(ev.session.tools.map((t) => t.name), ['save_answer', 'get_plan_section']);
  assert.equal(ev.session.tool_choice, 'auto');
  assert.deepEqual(Object.keys(ev.session).sort(), ['audio', 'instructions', 'tool_choice', 'tools', 'type']);
});

test('sends our session.update when the page sends none', async () => {
  const browser = new FakeSocket();
  const upstream = new FakeSocket();
  upstream.readyState = 0;
  await createSession({
    browser, upstream, caseId: ID, source: fakeSource(),
    profilesDir: await tmp('profiles-'), transcriptsDir: await tmp('transcripts-'), log,
  });
  browser.emit('message', Buffer.from(JSON.stringify({ type: 'input_audio_buffer.append', audio: 'AAAA' })));
  upstream.readyState = 1;
  upstream.emit('open');
  await until(() => upstream.sent.length === 4);
  const [update, kick, kickResponse, append] = upstream.json();
  assert.equal(kick.type, 'conversation.item.create');
  assert.equal(kickResponse.type, 'response.create');
  assert.equal(update.type, 'session.update');
  assert.match(update.session.instructions, /You are Sherpy/);
  assert.deepEqual(update.session.tools.map((t) => t.name), ['save_answer', 'get_plan_section']);
  assert.equal(update.session.tool_choice, 'auto');
  assert.deepEqual(update.session.audio, {
    input: { format: { type: 'audio/pcm', rate: 24000 }, turn_detection: { type: 'server_vad', silence_duration_ms: 600 } },
    output: { format: { type: 'audio/pcm', rate: 24000 }, voice: 'Charon' },
  });
  assert.equal(append.type, 'input_audio_buffer.append');
  // A later page session.update is still accepted and rewritten (only one is sent per page message).
  browser.emit('message', Buffer.from(JSON.stringify(pageUpdate)));
  await until(() => upstream.sent.length === 5);
  assert.equal(upstream.json()[4].session.tool_choice, 'auto');
});

test('refuses unknown case', () => {
  const ids = ['daniel-emily-johnson', 'michael-carter'];
  assert.equal(isAllowedCase('michael-carter', ids), true);
  assert.equal(isAllowedCase('samantha-lewis', ids), false);
  assert.equal(isAllowedCase('../x', [...ids, '../x']), false);
  assert.equal(isAllowedCase(null, ids), false);
  assert.equal(isAllowedCase(undefined, ids), false);
});

test('closes upstream when browser closes during a tool call', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const base = fakeSource();
  const slow = {
    armed: false,
    getPart(id, part, section) {
      return this.armed ? gate : base.getPart(id, part, section);
    },
  };
  const unhandled = [];
  const onUnhandled = (e) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  try {
    const { browser, upstream } = await start({ source: slow });
    slow.armed = true;
    upstream.emit('message', Buffer.from(functionCallDone('get_plan_section', { part: 'financial-health', section: 'score' })));
    await new Promise((r) => setTimeout(r, 20));
    browser.close();
    assert.equal(upstream.closed, true);
    release({ ok: true });
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(unhandled, []);
    assert.deepEqual(upstream.sent.map((m) => m.slice(0, 120)), []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('strips instructions from session events sent to the page', async () => {
  const { browser, upstream } = await start();
  for (const type of ['session.created', 'session.updated']) {
    upstream.emit('message', Buffer.from(JSON.stringify({ type, session: { id: 's1', instructions: 'SECRET BRIEF', tools: [{ name: 'x' }], model: 'm' } })));
  }
  const evs = browser.json();
  assert.equal(evs.length, 2);
  for (const ev of evs) {
    assert.deepEqual(ev.session, { id: 's1', model: 'm' });
  }
  assert.ok(!browser.sent.join('').includes('SECRET BRIEF'));
});

test('ignores function_call without call_id', async () => {
  const { upstream } = await start();
  upstream.emit('message', Buffer.from(JSON.stringify({
    type: 'response.done',
    response: { id: 'r9', output: [{ type: 'function_call', name: 'get_plan_section', arguments: '{"part":"financial-health"}' }] },
  })));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(upstream.sent.length, 0);
});

test('forces the Charon voice on every session.update', async () => {
  const fresh = await startRaw();
  assert.equal(fresh.upstream.json()[0].session.audio.output.voice, 'Charon');
  const { browser, upstream } = await start();
  const withVoice = structuredClone(pageUpdate);
  withVoice.session.audio.output.voice = 'alloy';
  browser.emit('message', Buffer.from(JSON.stringify(withVoice)));
  await until(() => upstream.sent.length === 1);
  const ev = upstream.json()[0];
  assert.equal(ev.session.audio.output.voice, 'Charon');
  assert.deepEqual(ev.session.audio.input, pageUpdate.session.audio.input);
});

test('greets first: one kickoff right after the session config', async () => {
  const { browser, upstream } = await startRaw();
  const sent = upstream.json();
  assert.deepEqual(sent.map((e) => e.type), ['session.update', 'conversation.item.create', 'response.create']);
  assert.equal(sent[1].item.role, 'user');
  assert.match(sent[1].item.content[0].text, /joined the call/);
  browser.emit('message', Buffer.from(JSON.stringify(pageUpdate)));
  await until(() => upstream.sent.length === 4);
  assert.equal(upstream.json()[3].type, 'session.update'); // no second kickoff
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(upstream.sent.length, 4);
});

async function startRaw() {
  const browser = new FakeSocket();
  const upstream = new FakeSocket();
  await createSession({
    browser, upstream, caseId: ID, source: fakeSource(),
    profilesDir: await tmp('profiles-'), transcriptsDir: await tmp('transcripts-'), log,
  });
  return { browser, upstream };
}
