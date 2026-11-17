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

test('uses model lines with placeholders filled', async () => {
  const out = await run(good);
  assert.ok(out.every((l) => l.source === 'model'));
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
    assert.ok(out.filter((_, i) => i !== 1).every((l) => l.source === 'model'), `case ${n}`);
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
  assert.ok(out.every((l) => l.source === 'model'));
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
