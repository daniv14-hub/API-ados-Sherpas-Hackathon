// Tests for allowed answers per question, built from the case.
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOptions } from '../src/options.mjs';
import { CASES, loadCase } from './fixtures.mjs';

test('options for Johnson', () => {
  const { fh, personaMd } = loadCase('daniel-emily-johnson');
  const o = buildOptions(fh, personaMd);
  assert.deepEqual(o.present, ['Daniel', 'Emily']);
  assert.deepEqual(o.main_goal.map((g) => g.value), ['retirement', 'vacation', 'college']);
  assert.deepEqual(o.top_worry, ['retirement', 'protection', 'cash', 'debt', 'college', 'none']);
  assert.deepEqual(o.risk, ['conservative', 'moderate', 'growth']);
  assert.deepEqual(o.style, ['analytical', 'emotional']);
  assert.deepEqual(o.detail_level, ['low', 'medium', 'high']);
});

test('options for Carter', () => {
  const { fh, personaMd } = loadCase('michael-carter');
  const o = buildOptions(fh, personaMd);
  assert.deepEqual(o.present, ['Michael']);
  assert.deepEqual(o.main_goal.map((g) => g.value), ['vacation', 'purchase']);
  assert.equal(o.top_worry[0], 'retirement');
  assert.equal(o.top_worry.at(-1), 'none');
});

test('options never empty', () => {
  for (const id of CASES) {
    const { fh, personaMd } = loadCase(id);
    const o = buildOptions(fh, personaMd);
    assert.ok(o.top_worry.length >= 2, id);
    assert.ok(o.main_goal.length >= 1, id);
    assert.ok(o.main_goal.every((g) => g.label), id);
  }
});
