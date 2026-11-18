// Tests for GET /journey/<case> (only says whether the conversation is complete).
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJourneyPath, journeyView } from '../src/journey.mjs';

const CASES = ['daniel-emily-johnson', 'michael-carter'];

test('parseJourneyPath accepts allow-listed cases only', () => {
  assert.equal(parseJourneyPath('/journey/michael-carter', CASES), 'michael-carter');
  for (const p of ['/journey/', '/journey', '/journey/nobody', '/journey/../x', '/journey/michael-carter/x', '/missions/michael-carter'])
    assert.equal(parseJourneyPath(p, CASES), null, p);
});

test('journeyView reveals only the phase 1 flag', () => {
  const profile = { caseId: 'c', phase1Complete: true, people: { Daniel: { risk: 'high' } }, main_goal: { byPerson: { Daniel: 'college' } } };
  assert.deepEqual(journeyView(profile), { phase1Complete: true });
  assert.deepEqual(journeyView({ phase1Complete: false }), { phase1Complete: false });
  assert.deepEqual(journeyView({ phase1Complete: 'yes' }), { phase1Complete: false });
  assert.deepEqual(journeyView(null), { phase1Complete: false });
});
