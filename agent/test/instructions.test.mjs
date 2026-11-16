import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHERPY_RULES, GLOSSARY, sherpyInstructions } from '../src/instructions.mjs';
import { buildOptions } from '../src/options.mjs';
import { buildBrief } from '../src/brief.mjs';
import { newProfile, applyAnswer } from '../src/profile.mjs';
import { loadCase } from './fixtures.mjs';

const ID = 'daniel-emily-johnson';
function setup(id = ID) {
  const { fh, personaMd } = loadCase(id);
  const options = buildOptions(fh, personaMd);
  return { options, brief: buildBrief(fh, personaMd), profile: newProfile(id, options.present) };
}

test('rules contain the exact no-calculation lines', () => {
  assert.ok(SHERPY_RULES.includes('Never calculate.'));
  assert.ok(SHERPY_RULES.includes('Only say a figure that appears in the family brief or in a tool result.'));
  assert.ok(SHERPY_RULES.includes("That isn't in your plan, so I don't want to guess. Your advisor can help with that."));
});

test('rules include the glossary and nothing else as general knowledge', () => {
  for (const term of ['Net worth', 'Cash flow', 'Liquidity', '401(k) and IRA', 'Roth', '529', 'Living map']) {
    assert.ok(GLOSSARY.includes(`**${term}:**`), term);
  }
  assert.ok(GLOSSARY.includes('- **Net worth:** what the family owns minus what it owes.'));
  assert.ok(SHERPY_RULES.includes(GLOSSARY));
});

test('phase 1 instructions list Johnson goals and worries', () => {
  const { options, brief, profile } = setup();
  const text = sherpyInstructions({ phase: 1, brief, profile, options });
  assert.ok(text.includes(SHERPY_RULES));
  assert.ok(text.includes(brief));
  for (const g of options.main_goal) {
    assert.ok(text.includes(g.label), g.label);
    assert.ok(text.includes(`"${g.value}"`), g.value);
  }
  for (const w of options.top_worry) assert.ok(text.includes(`"${w}"`), w);
  for (const v of ['conservative', 'moderate', 'growth', 'analytical', 'emotional', 'low', 'medium', 'high']) {
    assert.ok(text.includes(`"${v}"`), v);
  }
  assert.ok(text.includes('dropped 20% in a year'));
  assert.ok(text.includes('Daniel') && text.includes('Emily'));
  assert.ok(text.includes('save_answer'));
  assert.ok(text.includes('"household"'));
});

test('conversation instructions: natural agenda, mediation, confirm before saving, closing', () => {
  const { options, brief, profile } = setup();
  const text = sherpyInstructions({ brief, profile, options }); // phase derived from the incomplete profile
  assert.equal(text, sherpyInstructions({ phase: 1, brief, profile, options }));
  const at = (s) => {
    const i = text.indexOf(s);
    assert.ok(i >= 0, `missing: ${s}`);
    return i;
  };
  const order = [at(SHERPY_RULES), at('THE CONVERSATION'), at('FAMILY BRIEF'), at(JSON.stringify(profile, null, 2))];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  at('This is a real conversation, not a questionnaire.');
  at('never read them out as a list');
  at('If the partners disagree on any topic, mediate');
  at('confirm it in one short sentence');
  at("I've got everything I need. I'm putting together your video now.");
  at('finish_conversation');
  at("Never answer for the family");
  at('right after their video');
  assert.ok(!text.includes('get_plan_section'), 'plan lookups belong after the video');
  assert.ok(!text.includes('PHASE TWO'));
});

test('rules never make Sherpy describe its own looks', () => {
  assert.ok(!/yak in a suit/.test(SHERPY_RULES));
  assert.match(SHERPY_RULES, /Never describe what you look like\./);
});

test('complete profile gets advisor instructions only by default', () => {
  const { options, brief, profile } = setup();
  const done = { ...profile, phase1Complete: true };
  const text = sherpyInstructions({ brief, profile: done, options });
  assert.equal(text, sherpyInstructions({ phase: 2, brief, profile: done, options }));
  assert.ok(!text.includes('PHASE ONE'));
});

test('phase 1 instructions for a single adult save joint answers as household', () => {
  const { options, brief, profile } = setup('michael-carter');
  assert.equal(options.present.length, 1);
  const text = sherpyInstructions({ phase: 1, brief, profile, options });
  assert.ok(/main goal and the worry directly with person "household"/i.test(text), text);
  assert.ok(!/disagree/i.test(text));
});

test('phase 1 instructions resume from a partial profile', () => {
  const { options, brief, profile } = setup();
  let p = applyAnswer(profile, { question: 'present', person: 'household', value: 'Daniel, Emily' }, options).profile;
  p = applyAnswer(p, { question: 'main_goal', person: 'household', value: 'college' }, options).profile;
  const text = sherpyInstructions({ phase: 1, brief, profile: p, options });
  assert.ok(text.includes(JSON.stringify(p, null, 2)));
  assert.ok(text.includes('Some answers may already be saved in the profile below. Skip topics already answered and continue with the first missing one.'));
});

test('phase 2 instructions include profile and not the question script', () => {
  const { options, brief, profile } = setup();
  const text = sherpyInstructions({ phase: 2, brief, profile, options });
  assert.ok(text.includes(SHERPY_RULES));
  assert.ok(text.includes(brief));
  assert.ok(text.includes(JSON.stringify(profile, null, 2)));
  assert.ok(text.includes('get_plan_section'));
  assert.ok(text.includes('detail_level'));
  assert.ok(!text.includes('dropped 20% in a year'));
  assert.ok(!text.includes('save_answer'));
});

test('template text contains no figures beyond approved copy', () => {
  const options = { present: ['Ann', 'Bob'], main_goal: [{ value: 'home', label: 'Buy a home.' }],
    top_worry: ['home', 'none'], risk: ['conservative', 'moderate', 'growth'], style: ['analytical', 'emotional'],
    detail_level: ['low', 'medium', 'high'] };
  const profile = newProfile('ann-bob', ['Ann', 'Bob']);
  delete profile.updatedAt;
  for (const phase of [1, 2]) {
    const text = sherpyInstructions({ phase, brief: 'BRIEF', profile, options });
    const nums = text.match(/(?<![A-Za-z_])\d+/g) ?? []; // digits inside identifiers (phase1Complete) are not figures
    for (const n of nums) assert.ok(['20', '401', '529'].includes(n), `phase ${phase}: unexpected figure ${n}`);
  }
});

test('unknown phase throws', () => {
  const { options, brief, profile } = setup();
  assert.throws(() => sherpyInstructions({ phase: 3, brief, profile, options }));
});

test('rules keep English and handle unclear input without restarting', () => {
  assert.match(SHERPY_RULES, /Always speak English, even if what you hear is in another language\./);
  assert.match(SHERPY_RULES, /Sorry, I didn't catch that\./);
  assert.match(SHERPY_RULES, /Never introduce yourself again/);
});

test('couples: risk differences must be mediated before moving on', () => {
  const { options, brief, profile } = setup();
  const text = sherpyInstructions({ phase: 1, brief, profile, options });
  assert.ok(text.includes('If their risk answers differ, do not move on yet.'), 'risk mediation line');
});
