// Tests for advice sources, hand-written Johnson missions, the generator standard on every case, scores.
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCase, CASES } from './fixtures.mjs';
import { listAdvice, adviceRef } from '../src/game/advice.mjs';
import { scoreFor, buildScoreTable } from '../src/game/score.mjs';
import { orderMissions, loadMissions } from '../src/game/missions.mjs';

const source = {
  async getPart(caseId, part) {
    const c = loadCase(caseId);
    return part === 'financial-health' ? c.fh : part === 'investment-analysis' ? c.ia : c.personaMd;
  },
};
const JOHNSON = 'daniel-emily-johnson';
const hand = JSON.parse(readFileSync(new URL('../data/missions/daniel-emily-johnson.json', import.meta.url), 'utf8'));

// Tiny path resolver: "FH: a.b[2][0].c" -> value in the case JSON.
function resolve(src, c) {
  const m = /^(FH|IA): (.+)$/.exec(src);
  assert.ok(m, `bad src ${src}`);
  const root = m[1] === 'FH' ? c.fh : c.ia;
  const parts = m[2].match(/[^.[\]]+/g);
  return parts.reduce((o, k) => (o == null ? undefined : o[k]), root);
}

test('listAdvice: S1 has 5 bullets for every case; S2 and S3 counts per case', async () => {
  const counts = {};
  for (const id of CASES) {
    const items = await listAdvice(source, id);
    const n = (s, f) => items.filter((i) => i.source === s && (!f || i.field === f)).length;
    assert.equal(n('S1'), 5, id);
    assert.equal(n('S2', 'recommendations_main') > 0, true, id);
    assert.equal(n('S2', 'assetAllocation'), 1, id);
    assert.equal(n('S3'), 5, id);
    assert.ok(items.every((i) => i.text && !i.text.includes('**')), id);
    counts[id] = n('S2', 'recommendations_main');
  }
  assert.deepEqual(counts, { 'timothy-melanie-weah': 5, 'michael-carter': 6, 'daniel-emily-johnson': 6, 'samantha-lewis': 6 });
});

test('Johnson advice list: 20 items, first S1 item is the protection bullet', async () => {
  const items = await listAdvice(source, JOHNSON);
  assert.equal(items.length, 20);
  assert.match(items[0].text, /^Start by strengthening your protection/);
  assert.equal(adviceRef(items[0]), 'S1:summary_recommendations:0');
});

test('every fact value equals the case JSON at its src (dollars rounded to whole)', () => {
  const c = loadCase(JOHNSON);
  const all = [...hand.missions.flatMap((m) => m.facts), ...hand.keepInView.flatMap((k) => k.facts)];
  assert.ok(all.length > 40);
  for (const fact of all) {
    const srcs = Array.isArray(fact.src) ? fact.src : [fact.src];
    const got = srcs.map((s) => resolve(s, c));
    for (const [i, g] of got.entries()) assert.notEqual(g, undefined, `unresolved ${srcs[i]}`);
    if (fact.verify === 'exists') continue;
    const v = got[0];
    let expected = v;
    if (fact.fmt === 'usd') expected = Math.round(v);
    else if (fact.fmt === 'months') expected = Number(v);
    else if (fact.fmt === 'date') expected = String(v).slice(0, 7);
    assert.equal(fact.value, expected, `${fact.label} @ ${fact.src}`);
  }
});

test('missions: 8 missions, 26 steps, default order, valid step shape', () => {
  assert.deepEqual(hand.missions.map((m) => m.id), ['M1', 'M2', 'M3', 'M5', 'M4', 'M6', 'M7', 'M8']);
  assert.equal(hand.missions.reduce((n, m) => n + m.steps.length, 0), 26);
  for (const m of hand.missions) {
    for (const s of m.steps) {
      assert.ok(['learn', 'prepare', 'decide', 'act', 'close'].includes(s.type), s.id);
      assert.ok(s.title && s.body && s.owner, s.id);
    }
  }
});

test('step text has no digits except 401(k)', () => {
  const text = [];
  for (const m of hand.missions) {
    text.push(m.title, m.scoreNote ?? '');
    for (const s of m.steps) text.push(s.title, s.body, s.kit ?? '');
  }
  for (const k of hand.keepInView) text.push(k.title, k.body);
  for (const t of text) assert.doesNotMatch(t.replaceAll('401(k)', ''), /\d/, t);
});

test('coverage: every Johnson advice item is referenced by at least one step or keep-in-view', async () => {
  const items = await listAdvice(source, JOHNSON);
  const refs = new Set([...hand.missions.flatMap((m) => [...m.adviceRefs, ...m.steps.flatMap((s) => s.adviceRefs ?? [])]), ...hand.keepInView.flatMap((k) => k.adviceRefs)]);
  for (const item of items) assert.ok(refs.has(adviceRef(item)), `uncovered ${adviceRef(item)}`);
  for (const r of refs) assert.ok(items.some((i) => adviceRef(i) === r), `dangling ${r}`);
});

test('score: Johnson path 52 -> 57 -> 60 -> 60 through the exact-lookup table', () => {
  const t = buildScoreTable(loadCase(JOHNSON).fh);
  assert.equal(scoreFor(t, []), 52);
  assert.equal(scoreFor(t, ['Raise mortality coverage']), 57);
  assert.equal(scoreFor(t, ['Raise mortality coverage', 'Add umbrella cover']), 60);
  assert.equal(scoreFor(t, ['Raise mortality coverage', 'Add umbrella cover', 'Raise annual savings']), 60);
  assert.equal(scoreFor(t, ['Add umbrella cover', 'Raise mortality coverage']), 60); // order-free
  assert.equal(scoreFor(t, ['Add umbrella cover']), 56);
});

test('score: Weah {card, life cover} = 73; Carter two moves -> null; unknown set -> null', () => {
  const w = buildScoreTable(loadCase('timothy-melanie-weah').fh);
  assert.equal(scoreFor(w, ['Pay down revolving card', 'Add life cover']), 73);
  const c = buildScoreTable(loadCase('michael-carter').fh);
  assert.equal(scoreFor(c, ['Add umbrella cover', 'Lower the withdrawal rate']), null);
  assert.equal(scoreFor(c, ['Add umbrella cover']), 31);
  assert.equal(scoreFor(c, ['Nope']), null);
});

test('orderMissions: plan order first, decision, then the family\'s choice, last at the end', () => {
  const ids = (l) => l.map((m) => m.id);
  assert.deepEqual(ids(orderMissions(hand.missions, null)), ['M1', 'M2', 'M3', 'M5', 'M4', 'M6', 'M7', 'M8']);
  assert.deepEqual(ids(orderMissions(hand.missions, ['M6', 'M4'])), ['M1', 'M2', 'M3', 'M6', 'M4', 'M5', 'M7', 'M8']);
});

test('loadMissions: Johnson stays handwritten (8 missions)', async () => {
  const j = await loadMissions(source, JOHNSON);
  assert.equal(j.source, 'handwritten');
  assert.equal(j.base, 52);
  assert.equal(j.missions.length, 8);
});

const INTERACTIVE = new Set(['fields', 'checklist', 'rank', 'agree', 'choice', 'email']);
test('generator standard: every other case, every advice item once, interactive steps, facts from the JSON', async () => {
  for (const id of CASES.filter((c) => c !== JOHNSON)) {
    const r = await loadMissions(source, id);
    const fh = loadCase(id).fh;
    assert.equal(r.source, 'derived');
    assert.ok(r.missions.length >= 5, `${id}: ${r.missions.length} missions`);
    const refs = [...r.missions.flatMap((m) => m.adviceRefs), ...r.keepInView.flatMap((k) => k.adviceRefs)];
    const advice = await listAdvice(source, id);
    assert.equal(refs.length, advice.length, `${id}: each advice item exactly once`);
    assert.deepEqual(new Set(refs), new Set(advice.map(adviceRef)));
    for (const m of r.missions) {
      assert.ok(m.steps.length >= 3);
      for (const s of m.steps) {
        assert.doesNotMatch(`${s.title} ${s.body}`, /\d/, `${id} ${s.id}: template wording has no digits`);
        if (s.type !== 'learn') assert.ok((s.ui ?? []).some((b) => INTERACTIVE.has(b.kind)), `${id} ${s.id}: interactive`);
      }
      for (const f of m.facts.filter((f) => f.fmt === 'usd')) assert.equal(f.value, Math.round(resolve(f.src, { fh })), `${id} ${f.src}`);
      if (m.moveTitle) assert.ok(fh.score.top_moves.some((t) => t.title === m.moveTitle));
    }
    const moveTitles = r.missions.map((m) => m.moveTitle).filter(Boolean);
    assert.equal(new Set(moveTitles).size, moveTitles.length, `${id}: a move is in one mission only`);
  }
});

test('generator: a case with missing fields never throws and invents nothing', async () => {
  const fh = structuredClone(loadCase('samantha-lewis').fh);
  delete fh.key_metrics; delete fh.narrative; fh.score.top_moves = [fh.score.top_moves[0]];
  const { generateMissions } = await import('../src/game/generate.mjs');
  const r = generateMissions(fh, []);
  assert.equal(r.missions.length, 1); // only the one move remains
  assert.ok(r.missions[0].facts.every((f) => f.key === 'score'));
  assert.deepEqual(generateMissions({ case: { household: [] }, score: {} }, []), { missions: [], keepInView: [] });
});

test('loadMissions: a dir override is used (derived when no file)', async () => {
  const r = await loadMissions(source, JOHNSON, { dir: '/nonexistent-missions-dir' });
  assert.equal(r.source, 'derived');
});
