import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMissionsPath, missionsView } from '../src/game/routes.mjs';

const CASES = ['daniel-emily-johnson', 'michael-carter'];

test('parseMissionsPath accepts allow-listed cases only', () => {
  assert.equal(parseMissionsPath('/missions/daniel-emily-johnson', CASES), 'daniel-emily-johnson');
  for (const p of ['/missions/', '/missions', '/missions/nobody', '/missions/../etc', '/missions/michael-carter/x', '/video/michael-carter'])
    assert.equal(parseMissionsPath(p, CASES), null, p);
});

test('missionsView drops data paths and keeps what the UI needs', () => {
  const loaded = {
    caseId: 'c', base: 50, table: { base: 50, moves: {}, combos: [] }, order: ['A'], source: 'derived',
    missions: [{ id: 'A', title: 'T', kind: 'joint', phase: 'first', effort: 'low', facts: [{ label: 'l', value: 1, fmt: 'usd', src: 'FH: x', verify: 'exists' }],
      steps: [{ id: 'A-1', type: 'learn', owner: 'you', title: 's', body: 'b', kit: null }], adviceRefs: ['S1:x:0'] }],
    keepInView: [{ id: 'K1', title: 't', body: 'b', facts: [{ label: 'l', value: 0.1, fmt: 'pct', src: 'IA: y' }], adviceRefs: [] }],
  };
  const v = missionsView(loaded, 'Case');
  assert.equal(v.label, 'Case');
  assert.equal(v.missions[0].facts[0].src, undefined);
  assert.equal(v.keepInView[0].facts[0].src, undefined);
  assert.equal(v.missions[0].adviceRefs, undefined);
  assert.equal(v.missions[0].steps[0].body, 'b');
  assert.equal(JSON.stringify(v).includes('FH:'), false);
});
