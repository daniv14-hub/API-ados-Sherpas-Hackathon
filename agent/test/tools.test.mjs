// Tests for save_answer, finish_conversation and get_plan_section.
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { toolDefinitions, handleToolCall, SECTIONS } from '../src/tools.mjs';
import { CaseSourceError } from '../src/case-source.mjs';
import { buildOptions } from '../src/options.mjs';
import { newProfile, applyAnswer } from '../src/profile.mjs';
import { loadCase } from './fixtures.mjs';

const ID = 'daniel-emily-johnson';
async function ctx(source = {}) {
  const { fh, personaMd } = loadCase(ID);
  const options = buildOptions(fh, personaMd);
  const profilesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tools-'));
  return { caseId: ID, profile: newProfile(ID, options.present), options, source, profilesDir };
}
const args = (o) => JSON.stringify(o);

test('incomplete profile exposes save_answer and finish_conversation', async () => {
  const { options } = await ctx();
  const defs = toolDefinitions(1, options);
  assert.deepEqual(defs.map((d) => d.name), ['save_answer', 'finish_conversation']);
  const d = defs[0];
  assert.equal(d.type, 'function');
  assert.deepEqual(d.parameters.properties.question.enum,
    ['present', 'main_goal', 'top_worry', 'risk', 'style', 'detail_level']);
  assert.equal(d.parameters.properties.person.type, 'string');
  assert.equal(d.parameters.properties.value.type, 'string');
  assert.deepEqual(d.parameters.required, ['question', 'person', 'value']);
  assert.ok(d.parameters.properties.person.description.includes('Daniel'));
  assert.ok(d.parameters.properties.value.description.includes('protection'));
});

test('complete profile exposes only get_plan_section', async () => {
  const { options } = await ctx();
  const defs = toolDefinitions(2, options);
  assert.deepEqual(defs.map((d) => d.name), ['get_plan_section']);
  const p = defs[0].parameters.properties;
  assert.deepEqual(p.part.enum, ['financial-health', 'investment-analysis', 'persona']);
  const all = [...new Set(Object.values(SECTIONS).flat())];
  assert.deepEqual(p.section.enum, all);
});

test('save_answer valid → ok and profile saved', async () => {
  const c = await ctx();
  const r = await handleToolCall('save_answer', args({ question: 'risk', person: 'Daniel', value: 'growth' }), c);
  assert.deepEqual(r.output, { ok: true, saved: { question: 'risk', person: 'Daniel', value: 'growth' }, phase1Complete: false });
  assert.equal(r.profile.people.Daniel.risk, 'growth');
  const onDisk = JSON.parse(await fs.readFile(path.join(c.profilesDir, `${ID}.json`), 'utf8'));
  assert.equal(onDisk.people.Daniel.risk, 'growth');
});

test('save_answer invalid JSON args → error output, nothing saved', async () => {
  const c = await ctx();
  const r = await handleToolCall('save_answer', '{not json', c);
  assert.equal(r.output.ok, false);
  assert.equal(typeof r.output.error, 'string');
  assert.equal(r.profile, undefined);
  assert.deepEqual(await fs.readdir(c.profilesDir), []);
});

test('save_answer value outside options → error output', async () => {
  const c = await ctx();
  const r = await handleToolCall('save_answer', args({ question: 'top_worry', person: 'household', value: 'my kids' }), c);
  assert.equal(r.output.ok, false);
  assert.equal(typeof r.output.error, 'string');
  assert.deepEqual(r.output.allowed, c.options.top_worry);
  assert.equal(r.profile, undefined);
  assert.deepEqual(await fs.readdir(c.profilesDir), []);
});

test('get_plan_section unknown section → error output', async () => {
  let called = false;
  const c = await ctx({ getPart: async () => { called = true; return {}; } });
  const r = await handleToolCall('get_plan_section', args({ part: 'financial-health', section: 'secrets' }), c);
  assert.equal(typeof r.output.error, 'string');
  assert.ok(Array.isArray(r.output.allowed));
  assert.equal(called, false);
});

test('get_plan_section returns section data from the source', async () => {
  const calls = [];
  const c = await ctx({ getPart: async (...a) => (calls.push(a), { published_score: 52 }) });
  const r = await handleToolCall('get_plan_section', args({ part: 'financial-health', section: 'score' }), c);
  assert.deepEqual(calls, [[ID, 'financial-health', 'score']]);
  assert.deepEqual(r.output, { part: 'financial-health', section: 'score', data: { published_score: 52 } });
});

test('get_plan_section persona returns the whole part', async () => {
  const calls = [];
  const c = await ctx({ getPart: async (...a) => (calls.push(a), '# Persona') });
  const r = await handleToolCall('get_plan_section', args({ part: 'persona' }), c);
  assert.deepEqual(calls, [[ID, 'persona', undefined]]);
  assert.equal(r.output.data, '# Persona');
});

test('get_plan_section returns plan_unavailable when MCP throws', async (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  const c = await ctx({ getPart: async () => { throw new CaseSourceError('down'); } });
  const r = await handleToolCall('get_plan_section', args({ part: 'financial-health', section: 'score' }), c);
  assert.deepEqual(r.output, { error: 'plan_unavailable' });
  assert.equal(logged.mock.callCount(), 1);
  assert.deepEqual(logged.mock.calls[0].arguments, ['get_plan_section failed:', 'CaseSourceError', 'down']);
});

test('get_plan_section caps output at 20000 chars', async () => {
  const c = await ctx({ getPart: async () => ({ big: 'x'.repeat(50000) }) });
  const r = await handleToolCall('get_plan_section', args({ part: 'financial-health', section: 'projections' }), c);
  assert.equal(r.output.truncated, true);
  assert.ok(JSON.stringify(r.output).length <= 20000, String(JSON.stringify(r.output).length));
});

test('unknown tool → error output', async () => {
  const c = await ctx();
  const r = await handleToolCall('rm_rf', '{}', c);
  assert.equal(typeof r.output.error, 'string');
  assert.equal(r.profile, undefined);
});

test('finish_conversation refuses while topics are missing', async () => {
  const c = await ctx();
  const r = await handleToolCall('finish_conversation', '{}', c);
  assert.equal(r.output.ok, false);
  assert.equal(r.output.error, 'not_finished');
  assert.ok(r.output.missing.includes('present'));
  assert.ok(r.output.missing.includes('risk:Daniel'));
  assert.ok(!r.finished);
});

test('finish_conversation finishes once phase 1 is complete', async () => {
  const c = await ctx();
  const answers = [
    ['present', 'household', 'Daniel, Emily'], ['main_goal', 'household', 'college'], ['top_worry', 'household', 'protection'],
    ['risk', 'Daniel', 'growth'], ['risk', 'Emily', 'moderate'], ['style', 'Daniel', 'analytical'],
    ['style', 'Emily', 'emotional'], ['detail_level', 'household', 'low'],
  ];
  for (const [question, person, value] of answers) {
    c.profile = applyAnswer(c.profile, { question, person, value }, c.options).profile;
  }
  assert.equal(c.profile.phase1Complete, true);
  const r = await handleToolCall('finish_conversation', '{}', c);
  assert.deepEqual(r.output, { ok: true, finished: true });
  assert.equal(r.finished, true);
});
