import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../public/step-logic.mjs';

const data = {
  label: 'Daniel & Emily Johnson',
  missions: [
    { id: 'M3', facts: [{ key: 'fcf', label: 'Free cash flow per year', value: 15032, fmt: 'usd' }], steps: [
      { id: 'M3-2', owner: 'each', ui: [{ kind: 'rank', items: [{ key: 'cash', label: 'Cash reserve' }, { key: 'card', label: 'Credit card' }] }] },
      { id: 'M3-3', owner: 'together', ui: [{ kind: 'agree', rankStep: 'M3-2', total: 'fcf' }] },
    ] },
    { id: 'M6', facts: [{ key: 'payment', label: 'Monthly payment', value: 450, fmt: 'usd' }], steps: [
      { id: 'M6-2', owner: 'together', ui: [{ kind: 'choice', keep: 'payment' }] },
      { id: 'M6-3', owner: 'Daniel', ui: [{ kind: 'fields', per: 'each', fields: [{ key: 'amt', label: 'Amount', kind: 'usd' }] }, { kind: 'checklist', items: [{ text: 'Done in the app' }] }] },
      { id: 'M6-4', owner: 'each', ui: [{ kind: 'fields', per: 'each', optional: true, fields: [{ key: 'x', label: 'X' }] }] },
    ] },
  ],
};
const step = (id) => data.missions.flatMap((m) => m.steps).find((s) => s.id === id);

test('people come from the label; a step owned by one person is just that person', () => {
  assert.deepEqual(S.peopleOf('Daniel & Emily Johnson'), ['Daniel', 'Emily']);
  assert.deepEqual(S.peopleOf('Michael Carter'), ['Michael']);
  assert.deepEqual(S.whoFor(step('M6-3'), step('M6-3').ui[0], ['Daniel', 'Emily']), ['Daniel']);
  assert.deepEqual(S.whoFor(step('M3-2'), step('M3-2').ui[0], ['Daniel', 'Emily']), ['Daniel', 'Emily']);
  assert.deepEqual(S.whoFor(step('M3-3'), step('M3-3').ui[0], ['Daniel', 'Emily']), ['_']);
});

test('stepReady: every person ranked; agree saved; choice needs an amount for "more"; fields and checklist filled', () => {
  const P = ['Daniel', 'Emily'];
  assert.equal(S.stepReady(step('M3-2'), {}, P), false);
  const one = { 'M3-2': { 0: { Daniel: { order: ['card', 'cash'], saved: true } } } };
  assert.equal(S.stepReady(step('M3-2'), one, P), false);
  one['M3-2'][0].Emily = { order: ['cash', 'card'], saved: true };
  assert.equal(S.stepReady(step('M3-2'), one, P), true);
  assert.equal(S.stepReady(step('M6-2'), { 'M6-2': { 0: { _: { pick: 'more' } } } }, P), false);
  assert.equal(S.stepReady(step('M6-2'), { 'M6-2': { 0: { _: { pick: 'more', amount: 600 } } } }, P), true);
  assert.equal(S.stepReady(step('M6-2'), { 'M6-2': { 0: { _: { pick: 'keep' } } } }, P), true);
  assert.equal(S.stepReady(step('M6-3'), { 'M6-3': { 0: { Daniel: { amt: 600 } } } }, P), false);
  assert.equal(S.stepReady(step('M6-3'), { 'M6-3': { 0: { Daniel: { amt: 600 } }, 1: { _: { 0: true } } } }, P), true);
  assert.equal(S.stepReady(step('M6-4'), {}, P), true); // optional fields
});

test('agreed amount and the sum of the family\'s own amounts', () => {
  const answers = { 'M3-3': { 0: { _: { order: ['cash', 'card'], amounts: { cash: 6000, card: 2400 }, saved: true } } } };
  assert.equal(S.agreedAmount(data, answers, 'cash'), 6000);
  assert.equal(S.agreedAmount(data, answers, 'retirement'), null);
  assert.equal(S.sumAmounts({ cash: 6000, card: 2400, x: 'no' }), 8400);
});

test('parseUsd keeps digits only; fillFacts formats facts of the mission', () => {
  assert.equal(S.parseUsd('$1,600,000'), 1600000);
  assert.equal(S.parseUsd('abc'), null);
  assert.equal(S.fillFacts('Up to {fcf} a year', data.missions[0]), 'Up to $15,032 a year');
  assert.equal(S.fillFacts('{nope}', data.missions[0]), '{nope}');
});

test('sanitizeAnswers keeps known steps and plain values only', () => {
  const raw = { 'M3-2': { 0: { Daniel: { order: ['card', 'cash', 5], saved: true, evil: { a: { b: { c: { d: 1 } } } } } } }, ZZ: { 0: {} }, 'M6-2': 'x' };
  const out = S.sanitizeAnswers(data, raw);
  assert.deepEqual(Object.keys(out), ['M3-2']);
  assert.deepEqual(out['M3-2'][0].Daniel.order, ['card', 'cash']);
  assert.equal(out['M3-2'][0].Daniel.saved, true);
  assert.deepEqual(S.sanitizeAnswers(data, null), {});
});
