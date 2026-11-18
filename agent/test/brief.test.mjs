import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrief, buildInterviewBrief } from '../src/brief.mjs';
import { CASES, loadCase } from './fixtures.mjs';

test('brief contains household and score', () => {
  const { fh, personaMd } = loadCase('daniel-emily-johnson');
  const brief = buildBrief(fh, personaMd);
  assert.ok(brief.includes('"Daniel"'));
  assert.ok(brief.includes('"Emily"'));
  assert.ok(brief.includes('52'));
});

test('brief numbers all exist in the sources', () => {
  for (const id of CASES) {
    const { fh, personaMd } = loadCase(id);
    const brief = buildBrief(fh, personaMd);
    const source = JSON.stringify(fh) + personaMd;
    const tokens = brief.match(/\d[\d,.]*/g) ?? [];
    for (const t of tokens) assert.ok(source.includes(t), `${id}: token ${t} not in sources`);
  }
});

test('brief stays under 30000 chars', () => {
  for (const id of CASES) {
    const { fh, personaMd } = loadCase(id);
    const len = buildBrief(fh, personaMd).length;
    assert.ok(len < 30000, `${id}: ${len}`);
  }
});

test('interview brief: verbatim, shorter, focused on people, goals and worries', () => {
  for (const id of CASES) {
    const { fh, personaMd } = loadCase(id);
    const b = buildInterviewBrief(fh, personaMd);
    const source = JSON.stringify(fh) + personaMd;
    for (const t of b.match(/\d[\d,.]*/g) ?? []) assert.ok(source.includes(t), `${id}: token ${t} not in sources`);
    assert.ok(b.length < 0.75 * buildBrief(fh, personaMd).length, `${id}: ${b.length}`);
    for (const s of ['case.household', 'goals.goalsSummary', 'narrative.summary_main', 'Objective concerns', 'Tensions']) {
      assert.ok(b.includes(s), `${id}: missing ${s}`);
    }
    assert.ok(!b.includes('accounts:'), `${id}: interview brief should not carry account details`);
  }
});
