// Tests for video build, cache, TTS limits and retries.
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createVideoBuilder, VideoError } from '../src/video/build.mjs';
import { speech } from '../src/video/voice.mjs';

const ID = 'daniel-emily-johnson';
const root = (f) => new URL(`../../cases/${ID}/${f}`, import.meta.url);
const source = {
  async getPart(id, part) {
    assert.equal(id, ID);
    if (part === 'persona') return readFileSync(root('persona.md'), 'utf8');
    return JSON.parse(readFileSync(root(`${part}.json`), 'utf8'));
  },
};
const profile = (over = {}) => ({
  caseId: ID, present: ['Daniel', 'Emily'],
  people: { Daniel: { risk: 'moderate', style: 'analytical' }, Emily: { risk: 'moderate', style: 'emotional' } },
  main_goal: { agreed: 'college', byPerson: {} }, top_worry: { agreed: 'none', byPerson: {} },
  detail_level: 'medium', phase1Complete: true, ...over,
});
const quiet = { warn() {}, log() {} };

async function setup(p = profile(), { failTts = false, clock } = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'video-build-'));
  const profilesDir = path.join(base, 'profiles');
  const videosDir = path.join(base, 'videos');
  await fs.mkdir(profilesDir);
  await fs.writeFile(path.join(profilesDir, `${ID}.json`), JSON.stringify(p));
  const calls = { tts: 0, complete: 0 };
  const builder = createVideoBuilder({
    source, profilesDir, videosDir, voice: 'test-voice', log: quiet, ...(clock && { now: clock }),
    complete: async () => { calls.complete++; throw new Error('no model'); }, // narration falls back to templates
    tts: async () => { calls.tts++; if (failTts) throw new Error('boom'); return Buffer.from('mp3'); },
  });
  return { builder, calls, videosDir };
}

test('builds once, then serves from cache without TTS or model calls', async () => {
  const { builder, calls, videosDir } = await setup();
  const v = await builder.get(ID);
  const n = v.scenes.length;
  assert.ok(n >= 3);
  assert.equal(calls.tts, n);
  assert.ok(v.scenes.every((s, i) => s.audio === `scene-${i}.mp3` && s.duration === null && s.props && s.text && s.segments));
  const [dirName] = await fs.readdir(videosDir);
  assert.match(dirName, new RegExp(`^${ID}-[0-9a-f]{12}$`));
  await fs.access(path.join(videosDir, dirName, 'video.json'));
  await fs.access(path.join(videosDir, dirName, 'scene-0.mp3'));
  const before = { ...calls };
  const again = await builder.get(ID);
  assert.deepEqual(calls, before);
  assert.deepEqual(again, v);
});

test('incomplete profile -> VideoError profile_incomplete', async () => {
  const { builder } = await setup(profile({ phase1Complete: false, detail_level: null }));
  await assert.rejects(builder.get(ID), (e) => e instanceof VideoError && e.code === 'profile_incomplete');
});

test('tts failure -> scenes with audio null, video still returned and not cached', async () => {
  const { builder, videosDir } = await setup(profile(), { failTts: true });
  const v = await builder.get(ID);
  assert.ok(v.scenes.length > 0 && v.scenes.every((s) => s.audio === null));
  const [dirName] = await fs.readdir(videosDir);
  await assert.rejects(fs.access(path.join(videosDir, dirName, 'video.json')));
});

test('two concurrent gets share one build', async () => {
  const { builder, calls } = await setup();
  const [a, b] = await Promise.all([builder.get(ID), builder.get(ID)]);
  assert.equal(calls.tts, a.scenes.length);
  assert.deepEqual(a, b);
});

test('unsafe caseId is rejected before touching the filesystem', async () => {
  const { builder } = await setup();
  await assert.rejects(builder.get('../etc'), /unsafe caseId/);
});

test('speech posts to the proxy and never leaks the key in errors', async (t) => {
  const real = globalThis.fetch;
  t.after(() => { globalThis.fetch = real; });
  let seen;
  globalThis.fetch = async (url, init) => { seen = { url, init }; return new Response(Buffer.from('abc'), { status: 200 }); };
  const buf = await speech({ baseUrl: 'https://x.test/', key: 'SECRET', voice: 'v' })('hi');
  assert.equal(buf.toString(), 'abc');
  assert.equal(seen.url, 'https://x.test/v1/audio/speech');
  assert.deepEqual(JSON.parse(seen.init.body), { model: 'eleven-flash-v2.5', voice: 'v', input: 'hi' });
  globalThis.fetch = async () => new Response('nope', { status: 500 });
  await assert.rejects(speech({ baseUrl: 'https://x.test', key: 'SECRET', voice: 'v' })('hi'), (e) => /500/.test(e.message) && !/SECRET/.test(e.message));
});

test('partial tts failure is kept 5 minutes, peek never builds', async () => {
  let t = 1000;
  const { builder, calls } = await setup(profile(), { failTts: true, clock: () => t });
  assert.equal(await builder.peek(ID), null); // nothing built yet
  assert.deepEqual(calls, { tts: 0, complete: 0 });
  const first = await builder.get(ID);
  const spent = calls.tts;
  assert.ok(spent > 0 && first.scenes.every((s) => s.audio === null));
  assert.deepEqual((await builder.peek(ID)).video, first);
  t += 4 * 60 * 1000;
  assert.deepEqual(await builder.get(ID), first);
  assert.equal(calls.tts, spent);
  t += 2 * 60 * 1000;
  await builder.get(ID);
  assert.equal(calls.tts, spent * 2);
});

test('peek returns a cached video.json without any calls', async () => {
  const { builder, calls } = await setup();
  const v = await builder.get(ID);
  const before = { ...calls };
  const peeked = await builder.peek(ID);
  assert.deepEqual(peeked.video, v);
  assert.ok(peeked.dir);
  assert.deepEqual(calls, before);
});

test('TTS runs at most 3 clips at a time and retries a 429 once', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'video-build-'));
  await fs.mkdir(path.join(base, 'profiles'));
  await fs.writeFile(path.join(base, 'profiles', `${ID}.json`), JSON.stringify(profile()));
  let active = 0, peak = 0, first429 = true;
  const builder = createVideoBuilder({
    source, profilesDir: path.join(base, 'profiles'), videosDir: path.join(base, 'videos'), voice: 'v', log: quiet, retryDelayMs: 1,
    complete: async () => { throw new Error('no model'); },
    tts: async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      if (first429) { first429 = false; throw new Error('speech failed: HTTP 429'); }
      return Buffer.from('mp3');
    },
  });
  const v = await builder.get(ID);
  assert.ok(peak <= 3, `peak ${peak}`);
  assert.ok(v.scenes.every((s) => s.audio), 'the 429 clip was retried');
});
