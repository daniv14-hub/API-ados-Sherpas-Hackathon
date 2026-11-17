import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCase, CASES } from './fixtures.mjs';
import { buildFacts, money } from '../src/video/facts.mjs';

test('Johnson facts match the case', () => {
  const { fh, personaMd } = loadCase('daniel-emily-johnson');
  const f = buildFacts(fh, personaMd);
  assert.deepEqual(f.people, ['Daniel', 'Emily']);
  assert.equal(f.score.value, 52); assert.equal(f.score.band, 'vulnerable');
  assert.deepEqual(f.score.weakest, { name: 'Insurance and protection', points: '0/20' });
  assert.deepEqual(f.goals.filter((g) => g.type === 'college').map((g) => [g.label, g.year]), [['College Oliver', 2033], ['College Sophia', 2035]]);
  assert.equal(f.goals.find((g) => g.type === 'retirement').year, 2044);
  assert.equal(f.goals.find((g) => g.type === 'vacation').amount, 4500);
  assert.deepEqual(f.gaps.college, { topic: 'college', label: 'College', have: 30000, haveLabel: 'in the 529', gap: 106552.38, gapLabel: 'still missing' });
  assert.equal(f.gaps.retirement.gap, 1427455.89);
  assert.equal(f.gaps.protection.have, 250000); assert.equal(f.gaps.protection.gap, 1350000);
  assert.equal(f.gaps.cash.gap, 92360); assert.equal(f.gaps.debt.gap, 18000);
  assert.deepEqual(f.moves[0], { title: 'Raise mortality coverage', before: 52, after: 57 });
  assert.equal(f.combined.after, 60);
  assert.equal(f.firstMission, 'Raise mortality coverage');
});
test('every case builds without throwing; missing facts are null', () => {
  for (const id of CASES) { const { fh, personaMd } = loadCase(id); const f = buildFacts(fh, personaMd); assert.ok(f.score.value >= 0); }
  const carter = buildFacts(...Object.values(loadCase('michael-carter')));
  assert.equal(carter.combined, null); assert.equal(carter.gaps.college, null);
  const weah = buildFacts(...Object.values(loadCase('timothy-melanie-weah')));
  assert.equal(weah.gaps.retirement, null); assert.equal(weah.gaps.cash, null);
});
test('money formats like the grounding check expects', () => {
  assert.equal(money(106552.38), '$106,552'); assert.equal(money(4500), '$4,500');
  assert.equal(money(1427455.89), '$1.43 million'); assert.equal(money(1000000), '$1 million');
});
