import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readJourneyParams, videoUrl, missionsUrl, nextVideoStep, PROFILE_RETRY_MS, showRotateHint, shouldAutoplay, DEFAULT_CASE,
} from '../public/journey-logic.mjs';

test('readJourneyParams reads case and flow; only flow=1 turns the flow on', () => {
  assert.deepEqual(readJourneyParams('?case=michael-carter&flow=1'), { caseId: 'michael-carter', flow: true });
  assert.deepEqual(readJourneyParams('?case=michael-carter'), { caseId: 'michael-carter', flow: false });
  for (const v of ['0', 'true', 'yes', ''] ) assert.equal(readJourneyParams(`?case=x&flow=${v}`).flow, false, v);
  assert.deepEqual(readJourneyParams(''), { caseId: DEFAULT_CASE, flow: false });
  assert.deepEqual(readJourneyParams(undefined), { caseId: DEFAULT_CASE, flow: false });
});

test('urls encode the case and add flow only when asked', () => {
  assert.equal(videoUrl('daniel-emily-johnson', { flow: true }), '/video.html?case=daniel-emily-johnson&flow=1');
  assert.equal(videoUrl('daniel-emily-johnson'), '/video.html?case=daniel-emily-johnson');
  assert.equal(missionsUrl('a b'), '/missions.html?case=a%20b');
});

test('nextVideoStep: 200 goes, 409 waits with growing delays then fails as incomplete', () => {
  assert.deepEqual(nextVideoStep(200, 0), { do: 'go' });
  const waits = PROFILE_RETRY_MS.map((_, i) => nextVideoStep(409, i));
  assert.ok(waits.every((w) => w.do === 'wait'));
  for (let i = 1; i < waits.length; i++) assert.ok(waits[i].ms > waits[i - 1].ms);
  assert.ok(PROFILE_RETRY_MS.reduce((a, b) => a + b, 0) <= 15000, 'gives up within 15 s');
  assert.deepEqual(nextVideoStep(409, PROFILE_RETRY_MS.length), { do: 'fail', reason: 'incomplete' });
});

test('nextVideoStep: server and network errors fail at once with a retry', () => {
  for (const s of [500, 502, 404, 0]) assert.deepEqual(nextVideoStep(s, 0), { do: 'fail', reason: 'error' }, String(s));
});

test('showRotateHint: portrait phones only, until dismissed', () => {
  assert.equal(showRotateHint({ width: 390, height: 844, dismissed: false }), true);
  assert.equal(showRotateHint({ width: 390, height: 844, dismissed: true }), false);
  assert.equal(showRotateHint({ width: 844, height: 390, dismissed: false }), false);
  assert.equal(showRotateHint({ width: 1280, height: 800, dismissed: false }), false);
  assert.equal(showRotateHint({ width: 1000, height: 1400, dismissed: false }), false); // big portrait screen
});

test('shouldAutoplay: flow mode only, and not behind the rotate hint', () => {
  assert.equal(shouldAutoplay({ flow: true, rotateHint: false }), true);
  assert.equal(shouldAutoplay({ flow: true, rotateHint: true }), false);
  assert.equal(shouldAutoplay({ flow: false, rotateHint: false }), false);
});

test('awaitVideo retries 409 on the schedule, then goes on 200', async () => {
  const { awaitVideo } = await import('../public/handoff.mjs');
  const answers = [409, 409, 200]; const slept = []; const urls = [];
  const r = await awaitVideo('daniel-emily-johnson', {
    fetchFn: async (u) => { urls.push(u); return { status: answers.shift() }; },
    sleep: async (ms) => { slept.push(ms); },
  });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(slept, PROFILE_RETRY_MS.slice(0, 2));
  assert.ok(urls.every((u) => u === '/video/daniel-emily-johnson'));
});

test('awaitVideo gives up: 500 at once, 409 after the schedule, network error at once', async () => {
  const { awaitVideo } = await import('../public/handoff.mjs');
  const sleep = async () => {};
  assert.deepEqual(await awaitVideo('c', { fetchFn: async () => ({ status: 500 }), sleep }), { ok: false, reason: 'error' });
  let n = 0;
  assert.deepEqual(await awaitVideo('c', { fetchFn: async () => { n++; return { status: 409 }; }, sleep }), { ok: false, reason: 'incomplete' });
  assert.equal(n, PROFILE_RETRY_MS.length + 1);
  assert.deepEqual(await awaitVideo('c', { fetchFn: async () => { throw new Error('offline'); }, sleep }), { ok: false, reason: 'error' });
});
