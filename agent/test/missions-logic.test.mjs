import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreFor, buildScoreTable } from '../src/game/score.mjs';
import * as L from '../public/missions-logic.mjs';

const hand = JSON.parse(readFileSync(new URL('../data/missions/daniel-emily-johnson.json', import.meta.url), 'utf8'));
const table = {
  base: 52,
  moves: { 'Raise mortality coverage': 57, 'Add umbrella cover': 56, 'Raise annual savings': 55 },
  combos: [
    { moves: ['Raise mortality coverage', 'Add umbrella cover'], score_after: 60 },
    { moves: ['Raise mortality coverage', 'Raise annual savings'], score_after: 60 },
    { moves: ['Raise mortality coverage', 'Add umbrella cover', 'Raise annual savings'], score_after: 60 },
    { moves: ['Add umbrella cover', 'Raise annual savings'], score_after: 59 },
  ],
};
const data = { caseId: 'daniel-emily-johnson', label: 'Daniel & Emily Johnson', base: 52, table, order: hand.order, missions: hand.missions, keepInView: hand.keepInView };

function finish(state, id) {
  const m = data.missions.find((x) => x.id === id);
  let completedNow = null;
  for (const s of m.steps) ({ state, completedNow } = L.toggleStep(data, state, id, s.id));
  return { state, completedNow };
}

test('steps unlock in order', () => {
  const s0 = L.emptyState();
  const m = data.missions[0];
  assert.equal(L.toggleStep(data, s0, m.id, m.steps[1].id).state, s0); // second step first: refused
  const { state } = L.toggleStep(data, s0, m.id, m.steps[0].id);
  assert.equal(state.done[m.steps[0].id], true);
  assert.equal(L.stepUnlocked(m, state, m.steps[1].id), true);
  assert.equal(L.stepUnlocked(m, state, m.steps[2].id), false);
});

test('undoing a step undoes the later ones and the completion', () => {
  let { state } = finish(L.emptyState(), 'M1');
  assert.deepEqual(state.completed, ['M1']);
  const m = data.missions[0];
  ({ state } = L.toggleStep(data, state, 'M1', m.steps[1].id));
  assert.equal(state.done[m.steps[0].id], true);
  assert.equal(state.done[m.steps[1].id], undefined);
  assert.equal(state.done[m.steps[3].id], undefined);
  assert.deepEqual(state.completed, []);
});

test('progress counts steps; completedNow fires once on the last step', () => {
  assert.deepEqual(L.progress(data, L.emptyState()), { done: 0, total: 26 });
  const r = finish(L.emptyState(), 'M1');
  assert.equal(r.completedNow, 'M1');
  assert.deepEqual(L.progress(data, r.state), { done: 4, total: 26 });
  assert.equal(L.toggleStep(data, r.state, 'M1', 'nope').state, r.state);
});

test('statuses: first unfinished mission in order is next', () => {
  const s = L.emptyState();
  assert.deepEqual(Object.values(L.missionStatuses(data, s)).slice(0, 3), ['next', 'open', 'open']);
  const { state } = finish(s, 'M1');
  const st = L.missionStatuses(data, state);
  assert.equal(st.M1, 'done');
  assert.equal(st.M2, 'next');
});

test('score path 52 -> 57 -> 60 -> 60 by exact lookup, and last known when not exact', () => {
  let state = L.emptyState();
  assert.deepEqual(L.scoreView(data, state, scoreFor), { score: 52, exact: true });
  state = finish(state, 'M1').state;
  assert.deepEqual(L.scoreView(data, state, scoreFor), { score: 57, exact: true });
  state = finish(state, 'M2').state;
  assert.deepEqual(L.scoreView(data, state, scoreFor), { score: 60, exact: true });
  state = finish(state, 'M3').state; // no move: still exact (same set)
  assert.deepEqual(L.scoreView(data, state, scoreFor), { score: 60, exact: true });
  state = finish(state, 'M4').state;
  assert.deepEqual(L.scoreView(data, state, scoreFor), { score: 60, exact: true });
  // a case with two moves and no combo: not exact, falls back to the last exact checkpoint
  const t2 = { base: 26, moves: { A: 31, B: 62 }, combos: [] };
  const d2 = { ...data, table: t2, missions: [{ id: 'X', moveTitle: 'A', steps: [{ id: 'x1' }] }, { id: 'Y', moveTitle: 'B', steps: [{ id: 'y1' }] }], order: ['X', 'Y'] };
  const v = L.scoreView(d2, { v: 1, done: {}, completed: ['X', 'Y'] }, scoreFor);
  assert.deepEqual(v, { score: 31, exact: false });
});

test('checkpoint line uses real data only', () => {
  let { state } = finish(L.emptyState(), 'M1');
  let c = L.checkpoint(data, state, 'M1', scoreFor);
  assert.equal(c.fact, 'Your score goes from 52 to 57.');
  assert.match(c.nextLine, /Next up: Shield what you've built/);
  state = finish(state, 'M2').state;
  state = finish(state, 'M3').state;
  state = finish(state, 'M5').state;
  c = L.checkpoint(data, state, 'M5', scoreFor);
  assert.match(c.fact, /^[^$]*(\$[\d,]+)?/); // a plan fact, formatted
  assert.ok(c.fact.includes('doesn\'t move the Sherpas score'));
  state = finish(state, 'M4').state;
  assert.equal(L.checkpoint(data, state, 'M4', scoreFor).fact, 'Your score stays at 60.');
});

test('formatFact', () => {
  assert.equal(L.formatFact({ fmt: 'usd', value: 124717.5 }), '$124,718');
  assert.equal(L.formatFact({ fmt: 'pct', value: 0.5479 }), '54.79%');
  assert.equal(L.formatFact({ fmt: 'pct', value: 0.249 }), '24.9%');
  assert.equal(L.formatFact({ fmt: 'months', value: 1.4 }), '1.4 months');
  assert.equal(L.formatFact({ fmt: 'date', value: '2034-01' }), 'Jan 2034');
  assert.equal(L.formatFact({ fmt: 'date', value: 'soon' }), 'soon');
  assert.equal(L.formatFact({ fmt: 'text', value: 'not in the plan' }), 'not in the plan');
});

test('owner labels, single-person cases and sanitizeState', () => {
  assert.equal(L.ownerLabel('each', false), 'Each of you');
  assert.equal(L.ownerLabel('together', true), 'You');
  assert.equal(L.ownerLabel(null, false), null);
  assert.equal(L.ownerLabel('Daniel', false), 'Daniel');
  assert.equal(L.isSingle('Michael Carter'), true);
  assert.equal(L.isSingle(data.label), false);
  const bad = L.sanitizeState(data, { v: 1, done: { 'M1-2': true, ghost: true }, completed: ['M9'] });
  assert.deepEqual(bad, L.emptyState()); // M1-2 without M1-1 is dropped
  assert.deepEqual(L.sanitizeState(data, 'junk'), L.emptyState());
  const ok = L.sanitizeState(data, finish(L.emptyState(), 'M1').state);
  assert.deepEqual(ok.completed, ['M1']);
});

test('buildScoreTable output works with the logic', () => {
  const fh = { score: { published_score: 10, top_moves: [{ title: 'A', score_after: 12 }], combined_moves: [] } };
  const d = { table: buildScoreTable(fh), missions: [{ id: 'X', moveTitle: 'A', steps: [{ id: 'x1' }] }], order: ['X'] };
  const { state } = L.toggleStep(d, L.emptyState(), 'X', 'x1');
  assert.equal(L.scoreView(d, state, scoreFor).score, 12);
});

test('viewHash: overview is empty, mission and checkpoint carry the mission id', () => {
  assert.equal(L.viewHash({ name: 'overview' }), '');
  assert.equal(L.viewHash({ name: 'mission', id: 'M1' }), '#m-M1');
  assert.equal(L.viewHash({ name: 'checkpoint', id: 'M2', fromDone: 3 }), '#checkpoint-M2');
  assert.equal(L.viewHash({ name: 'mission', id: 'a b' }), '#m-a%20b');
});

test('parseViewHash: round-trips, falls back to the overview for anything else', () => {
  assert.deepEqual(L.parseViewHash('#m-M1'), { name: 'mission', id: 'M1' });
  assert.deepEqual(L.parseViewHash('#checkpoint-M2'), { name: 'checkpoint', id: 'M2', fromDone: null });
  assert.deepEqual(L.parseViewHash('#m-a%20b'), { name: 'mission', id: 'a b' });
  for (const h of ['', '#', '#m-', '#checkpoint', '#checkpoint-', '#x-M1', '#m-%E0%A4%A', null, undefined]) {
    assert.deepEqual(L.parseViewHash(h), { name: 'overview' }, String(h));
  }
});

test('resolveView: unknown missions and checkpoints of unfinished missions go to the overview', () => {
  const s = finish(L.emptyState(), data.order[0]).state;
  assert.deepEqual(L.resolveView(data, s, { name: 'mission', id: 'nope' }), { name: 'overview' });
  assert.deepEqual(L.resolveView(data, s, { name: 'mission', id: data.order[1] }), { name: 'mission', id: data.order[1] });
  assert.deepEqual(L.resolveView(data, s, { name: 'checkpoint', id: data.order[1], fromDone: null }), { name: 'mission', id: data.order[1] });
  assert.deepEqual(L.resolveView(data, s, { name: 'checkpoint', id: data.order[0], fromDone: null }), { name: 'checkpoint', id: data.order[0], fromDone: null });
  assert.deepEqual(L.resolveView(data, s, { name: 'checkpoint', id: 'nope', fromDone: null }), { name: 'overview' });
});

test('adviceCard: topic from keywords, headline before an em dash, never a cut-off title', async () => {
  const { adviceCard } = await import('../public/missions-logic.mjs');
  assert.deepEqual(adviceCard({ title: 'Rebuild a liquidity cushion — Your $30,000 of acc', body: 'Rebuild a liquidity cushion — Your $30,000 of accessible cash covers a month.' }),
    { topic: 'Cash', headline: 'Rebuild a liquidity cushion', text: 'Your $30,000 of accessible cash covers a month.' });
  assert.deepEqual(adviceCard({ title: 'Your household leans on two paychecks', body: 'Your salaries are a large share of your net worth.' }),
    { topic: 'Your plan', headline: 'Your household leans on two paychecks', text: 'Your salaries are a large share of your net worth.' });
  assert.deepEqual(adviceCard({ title: 'Weigh retirement saving against college funding as one tradeoff with a clear pla', body: 'Weigh retirement saving against college funding as one tradeoff with a clear plan.' }),
    { topic: 'Retirement', headline: null, text: 'Weigh retirement saving against college funding as one tradeoff with a clear plan.' });
  assert.equal(adviceCard({ title: 'x', body: 'Use tax-advantaged accounts if they are open to you.' }).topic, 'Taxes');
});
