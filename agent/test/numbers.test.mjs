import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractNumbers, extractMentions, caseNumbers, isGrounded } from '../src/numbers.mjs';
import { loadCase } from './fixtures.mjs';

const ia = (id) => JSON.parse(readFileSync(new URL(`../../cases/${id}/investment-analysis.json`, import.meta.url), 'utf8'));
const grounded = (text, set) => extractMentions(text).every((m) => isGrounded(m, set));

test('extracts money, K/M, million, percents', () => {
  assert.deepEqual(extractNumbers('$1,600,000 or $1.6M or 1.6 million, 250K at 24.9%, score 52.'),
    [1600000, 1600000, 1600000, 250000, 24.9, 52]);
  assert.deepEqual(extractNumbers('In 2030 and by 2045, March 2031, but 2027 widgets'), [2027]);
  assert.deepEqual(extractNumbers('That is $15,032, then 3, 4.'), [15032, 3, 4]);
});

test('1.6 million matches 1600000', () => {
  const set = caseNumbers({ goal: 1600000 }, {}, '');
  assert.ok(grounded('about 1.6 million', set));
  assert.ok(grounded('$1.6M', set));
  const near = caseNumbers({ goal: 1632000 }, {}, '');
  assert.ok(grounded('$1.6 million', near));
});

test('percent p matches data p or p/100', () => {
  assert.ok(grounded('24.9%', caseNumbers({ r: 0.249 }, {}, '')));
  assert.ok(grounded('24.9%', caseNumbers({ r: 24.9 }, {}, '')));
  assert.ok(!grounded('24.9', caseNumbers({ r: 0.249 }, {}, '')));
});

test('flags 1350001 as not in case', () => {
  const { fh, personaMd } = loadCase('daniel-emily-johnson');
  const set = caseNumbers(fh, ia('daniel-emily-johnson'), personaMd);
  assert.ok(!grounded('you would need 1,350,001', set));
});

test('accepts 52 for Johnson', () => {
  const { fh, personaMd } = loadCase('daniel-emily-johnson');
  const set = caseNumbers(fh, ia('daniel-emily-johnson'), personaMd);
  assert.ok(grounded('Your score is 52', set));
});
