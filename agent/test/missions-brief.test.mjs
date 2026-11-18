import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missionsBrief, parseScreen, screenText } from '../src/missions-brief.mjs';

const view = {
  order: ['M1', 'M3'],
  missions: [
    { id: 'M3', title: 'Decide the cash flow', facts: [{ label: 'Free cash flow per year', value: 15032, fmt: 'usd' }],
      steps: [{ id: 'M3-1', title: 'See the needs', body: 'Four needs.' }, { id: 'M3-2', title: 'Pick an order', body: 'Each of you.' }] },
    { id: 'M1', title: 'Life cover', facts: [], steps: [{ id: 'M1-1', title: 'Get quotes', body: 'Ask two insurers.' }] },
  ],
};

test('missionsBrief numbers missions in screen order and steps within each, with formatted facts', () => {
  const t = missionsBrief(view);
  assert.match(t, /Mission 1: "Life cover"/);
  assert.match(t, /Mission 2: "Decide the cash flow"\n {2}Facts: Free cash flow per year: \$15,032\n {2}Step 1: "See the needs"\. Four needs\.\n {2}Step 2: "Pick an order"\. Each of you\./);
});

test('parseScreen keeps only known views, missions and steps', () => {
  assert.deepEqual(parseScreen({ view: 'mission', mission: 'M3', done: ['M3-1', 'X', 5] }, view), { view: 'mission', mission: 'M3', done: ['M3-1'] });
  assert.deepEqual(parseScreen({ view: 'mission', mission: 'nope' }, view), { view: 'overview', mission: null, done: [] });
  assert.equal(parseScreen('garbage', view), null);
  assert.equal(parseScreen({ view: 'evil' }, view), null);
});

test('screenText says where they are and what they marked done', () => {
  assert.equal(screenText({ view: 'overview', mission: null, done: [] }, view), 'They are on the missions map. No steps marked done yet.');
  assert.equal(screenText({ view: 'mission', mission: 'M3', done: ['M3-1', 'M1-1'] }, view),
    'They have mission 2 open: "Decide the cash flow". Steps marked done: mission 1 step 1, mission 2 step 1.');
  assert.equal(screenText({ view: 'checkpoint', mission: 'M1', done: ['M1-1'] }, view),
    'They just completed mission 1: "Life cover". Steps marked done: mission 1 step 1.');
});

test('missionsBrief also lists the advice that is not a mission, in full', () => {
  const t = missionsBrief({ ...view, keepInView: [{ id: 'K1', title: 'Two paychecks', body: 'Your salaries are a large share.', facts: [{ label: 'Salaries share', value: 0.5479, fmt: 'pct' }] }] });
  assert.match(t, /MORE ADVICE FROM THEIR PLAN[^\n]*\n- Your salaries are a large share\. \(Salaries share: 54\.79%\)/);
});
