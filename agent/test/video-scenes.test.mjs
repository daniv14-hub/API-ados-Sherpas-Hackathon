import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCase, CASES } from './fixtures.mjs';
import { buildFacts } from '../src/video/facts.mjs';
import { planScenes, fillLine } from '../src/video/scenes.mjs';
import { extractMentions, caseNumbers, isGrounded } from '../src/numbers.mjs';

const johnson = () => buildFacts(...Object.values(loadCase('daniel-emily-johnson')));
const profile = (over = {}) => ({ present: ['Daniel', 'Emily'], people: { Daniel: { style: 'analytical' }, Emily: { style: 'emotional' } },
  main_goal: { agreed: 'college' }, top_worry: { agreed: 'none' }, detail_level: 'high', phase1Complete: true, ...over });

test('five scenes in order; main goal first; worry none falls back to the main goal gap', () => {
  const s = planScenes(johnson(), profile());
  assert.deepEqual(s.map((x) => x.id), ['goals', 'standing', 'worry', 'act', 'mission']);
  assert.equal(s[0].props.goals[0].type, 'college');
  assert.equal(s[2].props.gap.topic, 'college');
  assert.equal(s[2].values.gap, '$106,552');
  assert.equal(s[3].values.after, '60');
  assert.equal(s[4].values.mission, 'Raise mortality coverage');
});
test('top_worry picks the scene 3 gap; a worry with no gap and no main-goal gap skips scene 3', () => {
  assert.equal(planScenes(johnson(), profile({ top_worry: { agreed: 'protection' } }))[2].props.gap.topic, 'protection');
  const carter = buildFacts(...Object.values(loadCase('michael-carter')));
  const ids = planScenes(carter, profile({ present: ['Michael'], people: { Michael: {} }, main_goal: { agreed: 'vacation' }, top_worry: { agreed: 'home' } })).map((x) => x.id);
  assert.ok(!ids.includes('worry'));
});
test('detail level sets maxWords; every template placeholder has a value', () => {
  for (const [lvl, n] of [['low', 18], ['medium', 28], ['high', 40]]) {
    for (const sc of planScenes(johnson(), profile({ detail_level: lvl }))) {
      assert.equal(sc.maxWords, n);
      const keys = (sc.template.match(/\{(\w+)\}/g) ?? []).map((k) => k.slice(1, -1));
      for (const k of keys) assert.ok(k in sc.values);
      assert.deepEqual([...new Set(keys)].sort(), Object.keys(sc.values).sort());
    }
  }
});
test('detail rules: pillars only on high; moves capped at 2 below high; missing detail is medium', () => {
  const at = (lvl) => planScenes(johnson(), profile({ detail_level: lvl }));
  assert.ok(at('high')[1].props.pillars);
  assert.equal(at('medium')[1].props.pillars, undefined);
  assert.equal(at('low')[3].props.moves.length, 2);
  assert.equal(at('high')[3].props.moves.length, 3);
  assert.equal(planScenes(johnson(), profile({ detail_level: undefined }))[0].maxWords, 28);
});
test('style picks the template: analytical, emotional and mixed differ; no style is mixed', () => {
  const t = (people) => planScenes(johnson(), profile({ people }))[1].template;
  const a = t({ Daniel: { style: 'analytical' }, Emily: { style: 'analytical' } });
  const e = t({ Daniel: { style: 'emotional' }, Emily: { style: 'emotional' } });
  const m = t({ Daniel: { style: 'analytical' }, Emily: { style: 'emotional' } });
  assert.equal(new Set([a, e, m]).size, 3);
  assert.equal(t({ Daniel: {}, Emily: {} }), m);
  assert.equal(planScenes(johnson(), profile({ present: ['Daniel'], people: { Daniel: { style: 'analytical' } } }))[1].template, a);
});
test('fillLine marks filled values as key segments', () => {
  const r = fillLine('Your score is {score} out of 100.', { score: '52' });
  assert.equal(r.text, 'Your score is 52 out of 100.');
  assert.deepEqual(r.segments, [{ text: 'Your score is ', key: false }, { text: '52', key: true }, { text: ' out of 100.', key: false }]);
  assert.throws(() => fillLine('{x}', {}));
});
test('templates contain no digits except "100"', () => {
  for (const id of CASES) {
    const f = buildFacts(...Object.values(loadCase(id)));
    for (const st of ['analytical', 'emotional', undefined]) {
      for (const sc of planScenes(f, profile({ present: f.people, people: Object.fromEntries(f.people.map((n) => [n, { style: st }])) }))) {
        assert.equal(sc.template.replace(/out of 100/g, '').match(/\d/), null, sc.template);
      }
    }
  }
});
const MAIN = { 'timothy-melanie-weah': ['college', 'protection'], 'michael-carter': ['retirement', 'cash'],
  'daniel-emily-johnson': ['college', 'none'], 'samantha-lewis': ['vacation', 'none'] };
test('every filled template line is grounded and within maxWords, for all cases and detail levels', () => {
  for (const id of CASES) {
    const { fh, personaMd, ia } = loadCase(id);
    const f = buildFacts(fh, personaMd);
    const set = caseNumbers(fh, ia, personaMd);
    for (const st of ['analytical', 'emotional', undefined]) {
      for (const lvl of ['low', 'medium', 'high']) {
        const p = profile({ present: f.people, people: Object.fromEntries(f.people.map((n) => [n, { style: st }])),
          main_goal: { agreed: MAIN[id][0] }, top_worry: { agreed: MAIN[id][1] }, detail_level: lvl });
        for (const sc of planScenes(f, p)) {
          const { text } = fillLine(sc.template, sc.values);
          for (const m of extractMentions(text)) assert.ok(isGrounded(m, set), `${id} ${lvl} ${sc.id}: ${m.raw} in "${text}"`);
          assert.ok(text.split(/\s+/).length <= sc.maxWords, `${id} ${lvl} ${sc.id} too long: "${text}"`);
        }
      }
    }
  }
});
test('act line: no combined uses single-move wording; combined names the combined moves', () => {
  const carter = buildFacts(...Object.values(loadCase('michael-carter')));
  const c = planScenes(carter, profile({ present: ['Michael'], people: { Michael: { style: 'analytical' } }, main_goal: { agreed: 'retirement' }, top_worry: { agreed: 'cash' } }))[3];
  const ct = fillLine(c.template, c.values).text;
  assert.match(ct, /It lifts your score from 26 to 31/);
  const j = planScenes(johnson(), profile({ detail_level: 'medium' }))[3];
  const jt = fillLine(j.template, j.values).text;
  assert.match(jt, /raise mortality coverage and add umbrella cover/);
  assert.match(jt, /from 52 to 60/);
  const low = planScenes(johnson(), profile({ detail_level: 'low' }))[3];
  assert.match(fillLine(low.template, low.values).text, /With your other steps, you reach 60/);
});
