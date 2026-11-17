import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoPath } from '../src/video/routes.mjs';

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
