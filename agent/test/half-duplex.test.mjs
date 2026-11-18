// Tests for muting the mic while Sherpy's audio plays (so it never hears itself).
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { micMuted, TAIL } from '../public/half-duplex.mjs';

// Half-duplex (live test 17/11, laptop speaker): while Sherpy's audio plays, and a short tail after it,
// the mic sends silence, so Sherpy can't hear itself (ghost turns) and can't be cut off mid-sentence.

test('mic is open when nothing is playing', () => {
  assert.equal(micMuted(10, 0), false);
  assert.equal(micMuted(10, 5), false);
});

test('mic is muted while Sherpy audio is scheduled to play', () => {
  assert.equal(micMuted(10, 12), true);
  assert.equal(micMuted(10, 10.01), true);
});

test('mic stays muted for the tail after the last audio, then opens', () => {
  assert.equal(micMuted(10 + TAIL - 0.01, 10), true);
  assert.equal(micMuted(10 + TAIL + 0.01, 10), false);
});

test('tail is long enough for room echo but short enough not to eat a quick reply', () => {
  assert.ok(TAIL >= 0.3 && TAIL <= 0.8);
});
