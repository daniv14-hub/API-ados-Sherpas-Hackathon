import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, createFamilyScript } from '../public/demo-family-logic.mjs';

test('every line has a unique id, a speaker and no digits', () => {
  assert.equal(new Set(LINES.map((l) => l.id)).size, LINES.length);
  for (const l of LINES) { assert.ok(['Daniel', 'Emily'].includes(l.who)); assert.doesNotMatch(l.text, /\d/); }
});

test('a full conversation in Sherpy\'s usual wording follows the story', () => {
  const f = createFamilyScript();
  const r = (t) => f.reply(t);
  assert.equal(r("Hi, I'm Sherpy, your Sherpas advisor. Before we start, who's joining me today?"), 'present');
  assert.equal(r('Lovely to meet you both. What is the most important goal for you right now?'), 'goal-daniel');
  assert.equal(r('College for Oliver, I hear you. Emily, does that feel like the top goal for you too?'), 'goal-emily');
  assert.equal(r('You both care about the future. Can you tell me why each of these matters to you?'), 'goal-agree');
  assert.equal(r('So college comes first for you both, right?'), 'yes-daniel');
  assert.equal(r('What worries you most about your money?'), 'worry');
  assert.equal(r('Daniel, if your investments dropped 20% in a year, would you sell, wait, or buy more?'), 'risk-daniel');
  assert.equal(r('And Emily, what would you do if they fell that much?'), 'risk-emily');
  assert.equal(r('You see this differently. Emily, what feels at stake for you, and what would feel comfortable for you both?'), 'risk-agree');
  assert.equal(r('Daniel, do you prefer the numbers, or what it means for your family?'), 'style-daniel');
  assert.equal(r('Emily, how about you?'), 'yes-emily');
  assert.equal(r('Emily, do you like to hear the numbers, or what it means for the family?'), 'style-emily');
  assert.equal(r('Last one: do you want the big picture, the key numbers, or everything?'), 'detail');
  assert.equal(r("I've got everything I need. I'm putting together your video now."), null);
});

test('each disagreement line plays once; unknown questions get a yes from whoever is named', () => {
  const f = createFamilyScript();
  f.reply('What is your main goal?'); f.reply('Emily, what is your main goal?'); f.reply('What matters to each of you?');
  assert.equal(f.reply('Which goal comes first for you?'), 'yes-daniel');
  assert.equal(f.reply('Emily, is that okay?'), 'yes-emily');
});

test('real wording from the 18/11 rehearsal: the greeting asks who is speaking; never stuck repeating a yes', () => {
  const f = createFamilyScript();
  assert.equal(f.reply("Hello! I'm Sherpy, your advisor from Sherpas Wealth. I'd like to get to know you both a little better today through a few questions, because your honest answers really shape how we explain your plan. Who do I have the pleasure of speaking with today?"), 'present');
  const g = createFamilyScript();
  assert.equal(g.reply('Is that okay with you?'), 'yes-daniel');
  assert.equal(g.reply("Sorry, I didn't catch that. Could you please tell me your first names?"), 'present');
  const h = createFamilyScript();
  h.reply('Shall we begin?');
  assert.equal(h.reply("Sorry, I didn't quite catch that. Could you say that again?"), 'present'); // a generic that didn't land moves the story on
});

test('real wording: a goal question split in two questions', () => {
  const f = createFamilyScript();
  f.reply('Who is joining me today?');
  assert.equal(f.reply("It's great to have you both here. To start, what is your main goal right now? Is it planning for retirement, taking a regular vacation, or funding college for your children?"), 'goal-daniel');
});

test('real wording: risk mediation mentions drops again, Emily answers with the agreement line', () => {
  const f = createFamilyScript();
  f.reply('Daniel, how would you react if your investments dropped twenty percent in a single year?');
  f.reply('Emily, how would you react if your investments dropped twenty percent in a single year?');
  assert.equal(f.reply("Emily, it's completely normal to feel nervous about drops. Daniel, you'd buy more, and Emily, you'd wait it out. This means we have to balance both views for your shared plan. What feels at stake for each of you regarding market drops?"), 'risk-agree');
});

test('18/11 take: Sherpy saves the goal for both and moves on; the family never goes back to the goal', () => {
  const f = createFamilyScript();
  f.reply('Who is joining me today?');
  assert.equal(f.reply('What is your main goal right now?'), 'goal-daniel');
  assert.equal(f.reply("Great, I've saved college as your main goal. What worries you most about your money?"), 'worry');
  assert.notEqual(f.reply('And what matters most to you about your goals, Emily?'), 'goal-emily');
});

test('Sherpy repeating the same question: the family moves on instead of repeating itself', () => {
  const f = createFamilyScript();
  f.reply('Who is joining me today?');
  const a = f.reply('Is that okay with both of you?');
  const b = f.reply('Is that okay with both of you?');
  assert.notEqual(a, b);
  assert.equal(b, 'goal-daniel');
});

test('risk asked to Emily first, then Daniel: both answer (no skipping inside a topic)', () => {
  const f = createFamilyScript();
  assert.equal(f.reply('Emily, if your investments dropped twenty percent, what would you do?'), 'risk-emily');
  assert.equal(f.reply('Daniel, how about you? If investments dropped twenty percent, what would your reaction be?'), 'risk-daniel');
});
