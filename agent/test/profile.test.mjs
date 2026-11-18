import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isSafeCaseId, newProfile, applyAnswer, isPhase1Complete, loadProfile, saveProfile } from '../src/profile.mjs';
import { buildOptions } from '../src/options.mjs';
import { loadCase } from './fixtures.mjs';

const ID = 'daniel-emily-johnson';
function setup() {
  const { fh, personaMd } = loadCase(ID);
  const options = buildOptions(fh, personaMd);
  return { options, profile: newProfile(ID, options.present) };
}

test('rejects unsafe caseId', async () => {
  for (const bad of ['../x', 'A', '']) assert.equal(isSafeCaseId(bad), false);
  assert.equal(isSafeCaseId(ID), true);
  await assert.rejects(() => loadProfile('/tmp', '../x', []));
  await assert.rejects(() => saveProfile('/tmp', { caseId: '../x' }));
});

test('saves risk per person', () => {
  const { options, profile } = setup();
  const frozen = JSON.stringify(profile);
  const r = applyAnswer(profile, { question: 'risk', person: 'Daniel', value: 'growth' }, options);
  assert.equal(r.ok, true);
  assert.equal(r.profile.people.Daniel.risk, 'growth');
  assert.equal(JSON.stringify(profile), frozen);
  assert.notEqual(r.profile, profile);
});

test('rejects value outside options', () => {
  const { options, profile } = setup();
  const r = applyAnswer(profile, { question: 'risk', person: 'Daniel', value: 'yolo' }, options);
  assert.equal(r.ok, false);
  assert.equal(typeof r.error, 'string');
  assert.equal(profile.people.Daniel.risk, undefined);
});

test('rejects unknown person', () => {
  const { options, profile } = setup();
  const r = applyAnswer(profile, { question: 'risk', person: 'Zed', value: 'growth' }, options);
  assert.equal(r.ok, false);
});

test('stores disagreement byPerson and agreed separately', () => {
  const { options, profile } = setup();
  let r = applyAnswer(profile, { question: 'top_worry', person: 'Daniel', value: 'retirement' }, options);
  r = applyAnswer(r.profile, { question: 'top_worry', person: 'Emily', value: 'protection' }, options);
  assert.equal(r.profile.top_worry.agreed, null);
  assert.deepEqual(r.profile.top_worry.byPerson, { Daniel: 'retirement', Emily: 'protection' });
  r = applyAnswer(r.profile, { question: 'top_worry', person: 'household', value: 'protection' }, options);
  assert.equal(r.profile.top_worry.agreed, 'protection');
  assert.equal(r.profile.top_worry.byPerson.Daniel, 'retirement');
});

test('phase1Complete only when all fields set', () => {
  const { options, profile } = setup();
  const seq = [
    { question: 'present', person: 'household', value: 'Daniel, Emily' },
    { question: 'main_goal', person: 'household', value: 'college' },
    { question: 'top_worry', person: 'household', value: 'protection' },
    { question: 'risk', person: 'Daniel', value: 'growth' },
    { question: 'risk', person: 'Emily', value: 'moderate' },
    { question: 'style', person: 'Daniel', value: 'analytical' },
    { question: 'style', person: 'Emily', value: 'emotional' },
    { question: 'detail_level', person: 'household', value: 'low' },
  ];
  let p = profile;
  seq.forEach((a, i) => {
    const r = applyAnswer(p, a, options);
    assert.equal(r.ok, true, JSON.stringify(r));
    p = r.profile;
    assert.equal(p.phase1Complete, i === seq.length - 1, `step ${i}`);
  });
  assert.deepEqual(p.present, ['Daniel', 'Emily']);
  assert.equal(isPhase1Complete(p), true);
});

test('present rejects names outside options', () => {
  const { options, profile } = setup();
  assert.equal(applyAnswer(profile, { question: 'present', person: 'household', value: 'Daniel, Bob' }, options).ok, false);
});

test('loadProfile returns fresh profile on missing file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prof-'));
  const p = await loadProfile(dir, ID, ['Daniel', 'Emily']);
  assert.deepEqual(p, { ...newProfile(ID, ['Daniel', 'Emily']), updatedAt: p.updatedAt });
});

test('loadProfile returns fresh profile on corrupt file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prof-'));
  await fs.writeFile(path.join(dir, `${ID}.json`), '{not json');
  const p = await loadProfile(dir, ID, ['Daniel', 'Emily']);
  assert.equal(p.caseId, ID);
  assert.equal(p.phase1Complete, false);
});

test('save then load round-trips', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'prof-'));
  const dir = path.join(base, 'nested');
  const { options, profile } = setup();
  const r = applyAnswer(profile, { question: 'risk', person: 'Emily', value: 'moderate' }, options);
  await saveProfile(dir, r.profile);
  const back = await loadProfile(dir, ID, options.present);
  assert.deepEqual(back, r.profile);
  assert.deepEqual(await fs.readdir(dir), [`${ID}.json`]);
});

test('loadProfile returns fresh profile on wrong-shape file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prof-'));
  const other = { ...newProfile('other-case', ['Daniel']) };
  for (const bad of ['{}', 'null', '[]', '42', JSON.stringify(other)]) {
    await fs.writeFile(path.join(dir, `${ID}.json`), bad);
    const p = await loadProfile(dir, ID, ['Daniel', 'Emily']);
    assert.equal(p.caseId, ID, bad);
    assert.deepEqual(p.people, { Daniel: {}, Emily: {} }, bad);
  }
});
