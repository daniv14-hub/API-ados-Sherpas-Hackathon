import { money } from './facts.mjs';

// Scenes are chosen from facts + profile. Narration is template text written by us; every number
// reaches the text through a {placeholder} filled from facts. Templates contain no digits except
// "100" in "out of 100" (the score scale is in the case data).

const MAX_WORDS = { low: 18, medium: 28, high: 40 };
const GOAL_PHRASE = { retirement: 'a calm retirement', college: 'paying for college', vacation: 'a great vacation', purchase: 'your big purchase' };

const joinNames = (names) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// One adult: their style. Couple with the same style: that style. Different or unknown: mixed.
function styleOf(names, profile) {
  const set = new Set();
  for (const n of names) {
    const s = profile.people?.[n]?.style;
    if (s === 'analytical' || s === 'emotional') set.add(s); else { set.add('analytical'); set.add('emotional'); }
  }
  return set.size === 1 ? [...set][0] : 'mixed';
}

const TEMPLATES = {
  goals: {
    analytical: '{names}, your plan is built around {goal}. Let\'s see where you stand.',
    emotional: '{names}, what matters most to you is {goal}. That is where we begin.',
    mixed: '{names}, you told me {goal} matters most. We start there and check the facts.',
  },
  standing: {
    analytical: 'Your plan scores {score} out of 100, which is {band}. Weakest area: {weakest}.',
    emotional: '{names}, your plan sits at {score} out of 100: {band}. {weakest} needs care.',
    mixed: '{names}, you score {score} out of 100: {band}. {weakest} needs care first.',
  },
  worry: {
    analytical: '{label}: {gap} {gapLabel}. This is the biggest gap to close.',
    emotional: '{names}, here is what pulls at your plan most: {label}, {gap} {gapLabel}.',
    mixed: '{names}, the biggest gap is {label}: {gap} {gapLabel}.',
  },
  mission: {
    analytical: 'Your first mission: {mission}. Complete it and the progress bar moves.',
    emotional: '{names}, your first mission is {mission}. A small step, real progress.',
    mixed: '{names}, your first mission: {mission}. The progress bar moves when you finish.',
  },
};
const ACT_LEAD = {
  analytical: 'Step one: {move}.',
  emotional: '{names}, begin with {move}.',
  mixed: '{names}, start with {move}.',
};
const ACT_LIFT = {
  named: 'Together, your score goes from {before} to {after}.',
  others: 'With your other steps, you reach {after}.',
  single: 'It lifts your score from {before} to {after}.',
};

const placeholders = (t) => [...new Set([...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];

function scene(id, props, template, all, maxWords) {
  const values = {};
  for (const k of placeholders(template)) {
    if (!(k in all)) throw new Error(`scene ${id}: no value for {${k}}`);
    values[k] = all[k];
  }
  return { id, props, values, template, maxWords };
}

export function planScenes(facts, profile) {
  const names = profile.present?.length ? profile.present : facts.people;
  const style = styleOf(names, profile);
  const maxWords = MAX_WORDS[profile.detail_level] ?? MAX_WORDS.medium;
  const high = profile.detail_level === 'high';
  const mainGoal = profile.main_goal?.agreed;
  const worry = profile.top_worry?.agreed;
  const common = { names: joinNames(names) };
  const scenes = [];

  const goals = [...facts.goals.filter((g) => g.type === mainGoal), ...facts.goals.filter((g) => g.type !== mainGoal)];
  scenes.push(scene('goals', { people: names, goals }, TEMPLATES.goals[style],
    { ...common, goal: GOAL_PHRASE[mainGoal] ?? 'your goals' }, maxWords));

  const sc = facts.score;
  scenes.push(scene('standing', { score: sc.value, band: sc.band, colour: sc.colour, weakest: sc.weakest, ...(high ? { pillars: sc.pillars } : {}) },
    TEMPLATES.standing[style], { ...common, score: String(sc.value), band: sc.band, weakest: sc.weakest.name }, maxWords));

  const gap = facts.gaps[worry] ?? facts.gaps[mainGoal] ?? null;
  if (gap) {
    scenes.push(scene('worry', { gap }, TEMPLATES.worry[style],
      { ...common, label: gap.label, gap: money(gap.gap), gapLabel: gap.gapLabel }, maxWords));
  }

  if (facts.moves.length) {
    const first = facts.moves[0];
    const c = facts.combined;
    // Name what is combined (from the data); with more than two moves, or at low detail, lead with the
    // first move and say the lift comes with the other steps.
    const named = c && c.moves.length <= 2 && maxWords > MAX_WORDS.low;
    const lead = ACT_LEAD[style].replace('{move}', named ? '{moves}' : '{move}');
    const template = `${lead} ${named ? ACT_LIFT.named : c ? ACT_LIFT.others : ACT_LIFT.single}`;
    scenes.push(scene('act', { moves: high ? facts.moves : facts.moves.slice(0, 2), combined: c, before: first.before }, template,
      { ...common, move: lowerFirst(first.title), moves: c ? joinNames(c.moves.map(lowerFirst)) : '', before: String(first.before), after: String(c ? c.after : first.after) }, maxWords));
  }

  if (facts.firstMission) {
    scenes.push(scene('mission', { mission: facts.firstMission }, TEMPLATES.mission[style],
      { ...common, mission: facts.firstMission }, maxWords));
  }
  return scenes;
}

// Fills {key} placeholders. Filled values are returned as key segments (for highlighting).
export function fillLine(template, values) {
  const segments = [];
  for (const [i, part] of template.split(/\{(\w+)\}/).entries()) {
    if (i % 2 === 0) { if (part) segments.push({ text: part, key: false }); continue; }
    if (!(part in values)) throw new Error(`fillLine: no value for {${part}}`);
    segments.push({ text: String(values[part]), key: true });
  }
  return { text: segments.map((s) => s.text).join(''), segments };
}
