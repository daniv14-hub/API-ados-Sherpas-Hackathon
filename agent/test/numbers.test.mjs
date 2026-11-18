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
  assert.ok(grounded('250K', caseNumbers({ x: 250400 }, {}, '')));
  assert.ok(!grounded('$1.7 million', near));
  assert.ok(!grounded('$1,600,000', near));
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

const johnson = () => {
  const { fh, personaMd } = loadCase('daniel-emily-johnson');
  return caseNumbers(fh, ia('daniel-emily-johnson'), personaMd);
};

test('flags a calculated figure', () => {
  assert.ok(!grounded('that is $1,366,000 in total', johnson()));
});

test('exact mention does not match a rounded case value', () => {
  const set = johnson();
  assert.ok(!set.has(34000) && set.has(34164.77)); // data precondition
  assert.ok(!grounded('$34,000', set));
  assert.ok(grounded('$34,165', set));
  assert.ok(grounded('$41,032', caseNumbers({ x: 41032.01 }, {}, '')));
});

test('flags invented 1.3M', () => {
  // Data precondition: 8 Johnson values round to 1.3 million, so "$1.3M" is grounded there.
  // The invented figure used instead is "$1.37 million" (no value rounds to 1.37 at 2 decimals).
  assert.ok(grounded('$1.3M', johnson()));
  assert.ok(!grounded('$1.37 million', johnson()));
  assert.ok(!grounded('$1.3M', caseNumbers({ x: 1350001 }, {}, '')));
});
