// Tests for model wording with placeholders and the fallback to templates.
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCase } from './fixtures.mjs';
import { buildFacts } from '../src/video/facts.mjs';
import { planScenes } from '../src/video/scenes.mjs';
import { caseNumbers } from '../src/numbers.mjs';
import { narrate, chatComplete } from '../src/video/narrate.mjs';

const c = loadCase('daniel-emily-johnson');
const facts = buildFacts(c.fh, c.personaMd);
const numberSet = caseNumbers(c.fh, c.ia, c.personaMd);
const profile = { present: ['Daniel', 'Emily'], people: { Daniel: { style: 'analytical' }, Emily: { style: 'emotional' } },
  main_goal: { agreed: 'college' }, top_worry: { agreed: 'none' }, detail_level: 'medium', phase1Complete: true };
const scenes = planScenes(facts, profile);
const good = scenes.map((s) => `Here is {${Object.keys(s.values)[0]}} for you.`);
const run = (lines) => narrate(scenes, { complete: async () => JSON.stringify({ lines }), numberSet, profile });
const withLine = (i, line) => good.map((g, j) => (j === i ? line : g));
const sources = (out) => out.map((l) => l.source);
const free = (out) => out.filter((l) => l.id !== 'act'); // act is template-only

test('uses model lines with placeholders filled', async () => {
  const out = await run(good);
  assert.ok(free(out).every((l) => l.source === 'model'));
  assert.deepEqual(out.map((l) => l.id), scenes.map((s) => s.id));
  const k = Object.keys(scenes[1].values)[0];
  assert.equal(out[1].text, `Here is ${scenes[1].values[k]} for you.`);
  assert.ok(out[1].segments.some((s) => s.key));
});

test('a bad model line falls back to the template; the others stay model', async () => {
  const k = Object.keys(scenes[1].values)[0];
  const cases = [
    `You have 52 reasons {${k}}.`,
    'This uses {nonsense} here.',
    `{${k}} ` + 'word '.repeat(60),
    null,
  ];
  for (const [n, line] of cases.entries()) {
    let out;
    if (line === null) {
      // ungrounded fill: a value outside the case data
      const bad = scenes.map((s, i) => (i === 1 ? { ...s, values: { ...s.values, [k]: '$987,654' } } : s));
      out = await narrate(bad, { complete: async () => JSON.stringify({ lines: withLine(1, `Here is {${k}} for you.`) }), numberSet, profile });
    } else out = await run(withLine(1, line));
    assert.equal(out[1].source, 'template', `case ${n}`);
    assert.ok(free(out.filter((_, i) => i !== 1)).every((l) => l.source === 'model'), `case ${n}`);
  }
});

test('stray braces fall back to the template', async () => {
  const k = Object.keys(scenes[1].values)[0];
  for (const line of [`Here is {{${k}}} now.`, `Here is { ${k} } now.`, `Here is {${k} now.`]) {
    const out = await run(withLine(1, line));
    assert.equal(out[1].source, 'template', line);
  }
});

test('a fenced JSON reply is accepted', async () => {
  const fenced = '```json\n' + JSON.stringify({ lines: good }) + '\n```';
  const out = await narrate(scenes, { complete: async () => fenced, numberSet, profile });
  assert.ok(free(out).every((l) => l.source === 'model'));
});

test('a throwing complete logs one warning without secrets', async () => {
  const calls = [];
  const log = { warn: (m) => calls.push(m) };
  await narrate(scenes, { complete: async () => { throw new Error('HTTP 401'); }, numberSet, profile, log });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /narration fell back to templates: HTTP 401/);
});

test('non-JSON, wrong line count or a throwing complete -> all template lines', async () => {
  const mk = (complete) => narrate(scenes, { complete, numberSet, profile, log: { warn() {} } });
  for (const complete of [
    async () => 'not json at all',
    async () => JSON.stringify({ lines: good.slice(1) }),
    async () => { throw new Error('boom'); },
  ]) {
    const out = await mk(complete);
    assert.equal(out.length, scenes.length);
    assert.ok(sources(out).every((s) => s === 'template'));
  }
});

test('the prompt carries ids, keys and maxWords but no digits from filled values', async () => {
  let sent;
  await narrate(scenes, { complete: async (m) => { sent = m; return '{}'; }, numberSet, profile });
  const text = sent.map((m) => m.content).join('\n');
  for (const s of scenes) { assert.ok(text.includes(s.id)); assert.ok(text.includes(String(s.maxWords))); }
  assert.ok(!text.includes('106,552'));
  const body = text.replace(scenes.map((s) => s.maxWords).map((n) => `"maxWords": ${n}`).join('|') || '', '').replace(/"maxWords": \d+/g, '');
  assert.equal(body.match(/\d/), null);
});

test('chatComplete: non-2xx throws with the status and not the key', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('nope', { status: 401 });
  try {
    await assert.rejects(chatComplete({ baseUrl: 'http://x', key: 'SECRET123' })([{ role: 'user', content: 'hi' }]),
      (e) => /401/.test(e.message) && !e.message.includes('SECRET123'));
  } finally { globalThis.fetch = orig; }
});

test('chatComplete sends a minimal reasoning effort by default (15 s -> ~2.5 s on gpt-5-mini)', async () => {
  const orig = globalThis.fetch;
  let body;
  globalThis.fetch = async (_u, init) => { body = JSON.parse(init.body); return Response.json({ choices: [{ message: { content: 'ok' } }] }); };
  try {
    await chatComplete({ baseUrl: 'http://x', key: 'k' })([{ role: 'user', content: 'hi' }]);
    assert.equal(body.reasoning_effort, 'minimal');
    assert.equal(body.max_tokens, undefined);
  } finally { globalThis.fetch = orig; }
});

test('the prompt gives each scene its reference line and says only the first line greets', async () => {
  let sent;
  await narrate(scenes, { complete: async (m) => { sent = m; return '{}'; }, numberSet, profile });
  const text = sent.map((m) => m.content).join('\n');
  for (const s of scenes) {
    const ref = s.template.replace(/\b100\b/g, 'one hundred');
    assert.ok(text.includes(JSON.stringify(ref).slice(1, -1)), `reference for ${s.id}`);
  }
  assert.match(text, /only the first line greets/i);
  assert.match(text, /never praise/i);
});

test('a greeting by name is removed from every line but the first', async () => {
  const lines = good.map((g) => `Daniel and Emily, ${g.charAt(0).toLowerCase()}${g.slice(1)}`);
  const out = await run(lines);
  assert.match(out[0].text, /^Daniel and Emily, here is/);
  for (const l of free(out.slice(1))) { assert.equal(l.source, 'model'); assert.match(l.text, /^Here is /); }
  assert.ok(free(out.slice(1)).every((l) => l.segments[0].text.startsWith('Here')));
});

test('the prompt names the main goal for the goals scene', async () => {
  let sent;
  await narrate(scenes, { complete: async (m) => { sent = m; return '{}'; }, numberSet, profile });
  assert.match(sent.map((m) => m.content).join('\n'), /"mainGoal": "college"/);
});

test('a model line with a semicolon or a sentence over 20 words falls back to the template', async () => {
  const long = `Here is {${Object.keys(scenes[1].values)[0]}} and ${'more words '.repeat(10)}in one breath.`;
  const out = await run(withLine(1, long));
  assert.equal(out[1].source, 'template');
  const semi = await run(withLine(2, `Here is {${Object.keys(scenes[2].values)[0]}}; then more.`));
  assert.equal(semi[2].source, 'template');
});

test('the act scene always uses its template (the model mislabelled score changes as gap changes)', async () => {
  const i = scenes.findIndex((s) => s.id === 'act');
  const out = await run(good);
  assert.equal(out[i].source, 'template');
});
