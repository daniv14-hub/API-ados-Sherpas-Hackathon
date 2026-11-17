import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordTimes, estimateDuration, timeline } from '../public/video-player.mjs';

test('wordTimes spreads words by characters over the clip', () => {
  const w = wordTimes([{ text: 'Your score is ', key: false }, { text: '52', key: true }], 2);
  assert.deepEqual(w.map((x) => x.word), ['Your', 'score', 'is', '52']);
  assert.equal(w[0].start, 0); assert.ok(w[3].key); assert.ok(w[3].start < 2);
});
test('wordTimes keeps starts increasing and glues punctuation to the key word', () => {
  const w = wordTimes([{ text: 'Save ', key: false }, { text: '$1,200', key: true }, { text: ' a month.', key: false }], 3);
  assert.deepEqual(w.map((x) => x.word), ['Save', '$1,200', 'a', 'month.']);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start > w[i - 1].start);
  const g = wordTimes([{ text: 'up ', key: false }, { text: '5', key: true }, { text: '%.', key: false }], 1);
  assert.deepEqual(g.map((x) => x.word), ['up', '5%.']);
  assert.ok(g[1].key);
});
test('wordTimes on empty input is empty', () => {
  assert.deepEqual(wordTimes([], 2), []);
  assert.deepEqual(wordTimes([{ text: '  ', key: false }], 2), []);
});
test('estimateDuration is chars / 14', () => {
  assert.equal(estimateDuration('x'.repeat(28)), 2);
  assert.equal(estimateDuration(''), 0);
});
test('timeline chains scenes; missing duration uses the estimate', () => {
  const t = timeline([{ duration: 3, text: 'a' }, { duration: null, text: 'x'.repeat(28) }]);
  assert.deepEqual(t, [{ start: 0, duration: 3 }, { start: 3, duration: 2 }]);
});
