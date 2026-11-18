// Tests for video URLs, Range header and the JSON for the player.
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRange, parseVideoPath } from '../src/video/routes.mjs';

const CASES = ['daniel-emily-johnson', 'michael-carter'];

test('parseVideoPath accepts known cases and audio indexes only', () => {
  assert.deepEqual(parseVideoPath('/video/daniel-emily-johnson', CASES), { caseId: 'daniel-emily-johnson', audio: null });
  assert.deepEqual(parseVideoPath('/video/daniel-emily-johnson/audio/2.mp3', CASES), { caseId: 'daniel-emily-johnson', audio: 2 });
  for (const p of [
    '/video/../etc', '/video/nobody', '/video/', '/video', '/other/daniel-emily-johnson',
    '/video/daniel-emily-johnson/audio/x.mp3', '/video/daniel-emily-johnson/audio/-1.mp3',
    '/video/daniel-emily-johnson/audio/99.mp3x', '/video/daniel-emily-johnson/extra',
  ]) assert.equal(parseVideoPath(p, CASES), null, p);
});

test('parseRange handles single ranges and rejects bad ones', () => {
  assert.equal(parseRange(undefined, 100), null);
  assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=50-500', 100), { start: 50, end: 99 });
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-500', 100), { start: 0, end: 99 });
  for (const h of ['bytes=100-', 'bytes=20-10', 'bytes=-0', 'bytes=-', 'bytes=0-1,5-6', 'items=0-1', 'garbage']) {
    assert.equal(parseRange(h, 100), 'unsatisfiable', h);
  }
});
