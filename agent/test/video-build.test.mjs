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

async function setup(p = profile(), { failTts = false } = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'video-build-'));
  const profilesDir = path.join(base, 'profiles');
  const videosDir = path.join(base, 'videos');
  await fs.mkdir(profilesDir);
  await fs.writeFile(path.join(profilesDir, `${ID}.json`), JSON.stringify(p));
  const calls = { tts: 0, complete: 0 };
  const builder = createVideoBuilder({
    source, profilesDir, videosDir, voice: 'test-voice', log: quiet,
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
