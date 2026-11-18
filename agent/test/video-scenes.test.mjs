// Tests for the seven scenes, templates within word limits, grounded in all cases and styles.
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCase, CASES } from './fixtures.mjs';
import { buildFacts } from '../src/video/facts.mjs';
import { planScenes, fillLine } from '../src/video/scenes.mjs';
import { extractMentions, caseNumbers, isGrounded } from '../src/numbers.mjs';

const johnson = () => buildFacts(...Object.values(loadCase('daniel-emily-johnson')));
const profile = (over = {}) => ({ present: ['Daniel', 'Emily'], people: { Daniel: { style: 'analytical', risk: 'growth' }, Emily: { style: 'emotional', risk: 'moderate' } },
  main_goal: { agreed: 'college' }, top_worry: { agreed: 'none' }, detail_level: 'high', phase1Complete: true, ...over });
const byId = (scenes, id) => scenes.find((s) => s.id === id);
const text = (sc) => fillLine(sc.template, sc.values).text;
const carterFacts = () => buildFacts(...Object.values(loadCase('michael-carter')));
const carterProfile = (over = {}) => profile({ present: ['Michael'], people: { Michael: { style: 'analytical', risk: 'moderate' } },
  main_goal: { agreed: 'retirement' }, top_worry: { agreed: 'cash' }, ...over });

test('seven scenes in roller-coaster order (Johnson medium)', () => {
  const s = planScenes(johnson(), profile({ detail_level: 'medium' }));
  assert.deepEqual(s.map((x) => x.id), ['dream', 'reality', 'gaps', 'fragility', 'turn', 'act', 'mission']);
});
test('dream: main goal first (college before retirement), only their goals', () => {
  const d = byId(planScenes(johnson(), profile({ detail_level: 'medium' })), 'dream');
  assert.equal(d.props.goals[0].type, 'college');
  const t = text(d);
  assert.match(t, /Oliver starts college in 2033/);
  assert.ok(t.indexOf('college') < t.indexOf('retire'), t);
  assert.match(t, /2044/); assert.match(t, /62/); assert.match(t, /60/);
});
test('reality: not on track, score and weakest pillar', () => {
  const t = text(byId(planScenes(johnson(), profile({ detail_level: 'medium' })), 'reality'));
  assert.match(t, /not on track/);
  assert.match(t, /52 out of 100/); assert.match(t, /vulnerable/);
  assert.match(t, /Insurance and protection/); assert.match(t, /0 out of 20/);
});
test('gaps: main goal first, then retirement; cash only at high', () => {
  const at = (lvl) => byId(planScenes(johnson(), profile({ detail_level: lvl })), 'gaps');
  assert.deepEqual(at('medium').props.items.map((i) => i.topic), ['college', 'retirement']);
  assert.deepEqual(at('low').props.items.map((i) => i.topic), ['college', 'retirement']);
  assert.deepEqual(at('high').props.items.map((i) => i.topic), ['college', 'retirement', 'cash']);
  const t = text(at('high'));
  assert.ok(t.indexOf('college') < t.indexOf('etirement') && t.indexOf('etirement') < t.indexOf('cash'), t);
  assert.match(t, /\$30,000/); assert.match(t, /\$106,552/); assert.match(t, /\$1\.43 million/);
  assert.match(t, /covers 1 month;/); assert.match(t, /8 to 9/);
  assert.match(text(at('medium')), /nothing goes into your retirement accounts/i);
});
test('gaps: top worry comes right after the main goal', () => {
  const g = byId(planScenes(johnson(), profile({ detail_level: 'medium', main_goal: { agreed: 'retirement' }, top_worry: { agreed: 'cash' } })), 'gaps');
  assert.deepEqual(g.props.items.map((i) => i.topic), ['retirement', 'cash']);
});
test('fragility: names both people with cover and shortfall', () => {
  const f = byId(planScenes(johnson(), profile({ detail_level: 'medium' })), 'fragility');
  const t = text(f);
  assert.match(t, /Daniel/); assert.match(t, /Emily/);
  assert.match(t, /\$250,000/); assert.match(t, /\$1\.35 million/); assert.match(t, /\$200,000/); assert.match(t, /\$1 million/);
  assert.equal(f.props.people.length, 2);
});
test('turn: a solution, free cash flow, risk transformed (partners differ)', () => {
  const t = text(byId(planScenes(johnson(), profile({ detail_level: 'medium' })), 'turn'));
  assert.match(t, /solution, one step at a time/);
  assert.match(t, /\$15,032/);
  assert.match(t, /protect what you have first, then grow it/i);
  assert.match(t, /differently/);
  assert.doesNotMatch(t, /growth|moderate|you told me|you said/i);
});
test('act: life cover linked to the shortfall; combined lift 52 to 60; savings linked to retirement', () => {
  const t = text(byId(planScenes(johnson(), profile({ detail_level: 'medium' })), 'act'));
  assert.match(t, /life cover.*shortfall/);
  assert.match(t, /52/); assert.match(t, /60/);
  assert.match(t, /umbrella/);
  assert.match(t, /retirement gap/);
  const low = text(byId(planScenes(johnson(), profile({ detail_level: 'low' })), 'act'));
  assert.match(low, /With the other steps, your score goes from 52 to 60/);
  const high = text(byId(planScenes(johnson(), profile({ detail_level: 'high' })), 'act'));
  assert.match(high, /52 to 57/); assert.match(high, /52 to 56/);
});
test('mission: first move and the main goal year', () => {
  const m = byId(planScenes(johnson(), profile({ detail_level: 'medium' })), 'mission');
  assert.equal(m.values.mission, 'Raise mortality coverage');
  assert.match(text(m), /2033/);
  const r = byId(planScenes(johnson(), profile({ detail_level: 'medium', main_goal: { agreed: 'retirement' } })), 'mission');
  assert.match(text(r), /2044/);
});
test('no line repeats their answers', () => {
  for (const lvl of ['low', 'medium', 'high']) {
    for (const sc of planScenes(johnson(), profile({ detail_level: lvl }))) assert.doesNotMatch(text(sc), /you told me|you said|you chose/i);
  }
});
test('Carter (one adult, negative cash flow) builds; turn has no free cash flow', () => {
  for (const lvl of ['low', 'medium', 'high']) {
    const s = planScenes(carterFacts(), carterProfile({ detail_level: lvl }));
    const turn = byId(s, 'turn');
    assert.ok(!('freeCashFlow' in turn.values));
    assert.doesNotMatch(text(turn), /free|\$/);
    assert.equal(byId(s, 'fragility').props.people.length, 1);
    assert.match(text(byId(s, 'fragility')), /your paycheck/);
  }
  const act = text(byId(planScenes(carterFacts(), carterProfile({ detail_level: 'medium' })), 'act'));
  assert.match(act, /26 to 31/);
});
test('Lewis (no shortfall) skips fragility; Weah builds', () => {
  const lewis = buildFacts(...Object.values(loadCase('samantha-lewis')));
  const ids = planScenes(lewis, profile({ present: ['Samantha'], people: { Samantha: {} }, main_goal: { agreed: 'vacation' } })).map((x) => x.id);
  assert.ok(!ids.includes('fragility'));
  assert.equal(ids[0], 'dream'); assert.equal(ids.at(-1), 'mission');
});
test('detail level sets maxWords; every template placeholder has a value', () => {
  for (const [lvl, n] of [['low', 30], ['medium', 45], ['high', 60]]) {
    for (const sc of planScenes(johnson(), profile({ detail_level: lvl }))) {
      assert.equal(sc.maxWords, n);
      const keys = (sc.template.match(/\{(\w+)\}/g) ?? []).map((k) => k.slice(1, -1));
      assert.deepEqual([...new Set(keys)].sort(), Object.keys(sc.values).sort());
    }
  }
  assert.equal(planScenes(johnson(), profile({ detail_level: undefined }))[0].maxWords, 45);
});
test('detail rules: pillars only on high; moves capped at 2 on low', () => {
  const at = (lvl) => planScenes(johnson(), profile({ detail_level: lvl }));
  assert.ok(byId(at('high'), 'reality').props.pillars);
  assert.equal(byId(at('medium'), 'reality').props.pillars, undefined);
  assert.equal(byId(at('low'), 'act').props.moves.length, 2);
  assert.equal(byId(at('high'), 'act').props.moves.length, 3);
});
test('style picks the template: analytical, emotional and mixed differ; no style is mixed', () => {
  const t = (people) => byId(planScenes(johnson(), profile({ people })), 'reality').template;
  const a = t({ Daniel: { style: 'analytical' }, Emily: { style: 'analytical' } });
  const e = t({ Daniel: { style: 'emotional' }, Emily: { style: 'emotional' } });
  const m = t({ Daniel: { style: 'analytical' }, Emily: { style: 'emotional' } });
  assert.equal(new Set([a, e, m]).size, 3);
  assert.equal(t({ Daniel: {}, Emily: {} }), m);
  assert.equal(byId(planScenes(johnson(), profile({ present: ['Daniel'], people: { Daniel: { style: 'analytical' } } })), 'reality').template, a);
});
test('fillLine marks filled values as key segments', () => {
  const r = fillLine('Your score is {score} out of 100.', { score: '52' });
  assert.equal(r.text, 'Your score is 52 out of 100.');
  assert.deepEqual(r.segments, [{ text: 'Your score is ', key: false }, { text: '52', key: true }, { text: ' out of 100.', key: false }]);
  assert.throws(() => fillLine('{x}', {}));
});

const MAIN = { 'timothy-melanie-weah': ['college', 'protection'], 'michael-carter': ['retirement', 'cash'],
  'daniel-emily-johnson': ['college', 'none'], 'samantha-lewis': ['vacation', 'none'] };
const RISKS = { 'timothy-melanie-weah': ['conservative', 'conservative'], 'michael-carter': ['growth'],
  'daniel-emily-johnson': ['growth', 'moderate'], 'samantha-lewis': [undefined] };
test('all cases x detail x style: no digits in templates but "100", grounded, within maxWords', () => {
  for (const id of CASES) {
    const { fh, personaMd, ia } = loadCase(id);
    const f = buildFacts(fh, personaMd);
    const set = caseNumbers(fh, ia, personaMd);
    for (const st of ['analytical', 'emotional', undefined]) {
      for (const lvl of ['low', 'medium', 'high']) {
        const p = profile({ present: f.people, people: Object.fromEntries(f.people.map((n, i) => [n, { style: st, risk: RISKS[id][i] }])),
          main_goal: { agreed: MAIN[id][0] }, top_worry: { agreed: MAIN[id][1] }, detail_level: lvl });
        const scenes = planScenes(f, p);
        assert.equal(scenes[0].id, 'dream'); assert.equal(scenes.at(-1).id, 'mission');
        for (const sc of scenes) {
          assert.equal(sc.template.replace(/out of 100/g, '').match(/\d/), null, `${id} ${lvl} ${sc.id}: ${sc.template}`);
          const t = text(sc);
          for (const m of extractMentions(t)) assert.ok(isGrounded(m, set), `${id} ${lvl} ${sc.id}: ${m.raw} in "${t}"`);
          assert.ok(t.split(/\s+/).length <= sc.maxWords, `${id} ${lvl} ${sc.id} too long: "${t}"`);
          assert.doesNotMatch(t, /\{|\}|undefined|null|NaN/, `${id} ${lvl} ${sc.id}: ${t}`);
        }
      }
    }
  }
});
