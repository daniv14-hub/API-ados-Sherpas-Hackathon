// The seven scenes of the video story ('roller coaster'): dream -> reality -> gaps -> fragility -> turn ->
// act -> mission. Each scene has a template line with {placeholders}, the values to fill them, and props for
// the animation. Style (analytical / emotional / mixed) and detail level change wording and length.
import { money } from './facts.mjs';

// The roller-coaster story (spec, Revision 2): up (dream) -> down (reality, gaps, fragility) -> relief
// (turn, act, mission). Narration is template text written by us; every number reaches the text through a
// {placeholder} filled from facts. Templates contain no digits except "100" in "out of 100".
// Answers are used, never repeated: main goal anchors dream and mission, top worry orders gaps, risk feeds
// turn, style frames the lines, detail level sets figures and length.

const MAX_WORDS = { low: 30, medium: 45, high: 60 };

const joinNames = (names) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const wordCount = (t) => t.split(/\s+/).filter(Boolean).length;

// One adult: their style. Couple with the same style: that style. Different or unknown: mixed.
export function styleOf(names, profile) {
  const set = new Set();
  for (const n of names) {
    const s = profile.people?.[n]?.style;
    if (s === 'analytical' || s === 'emotional') set.add(s); else { set.add('analytical'); set.add('emotional'); }
  }
  return set.size === 1 ? [...set][0] : 'mixed';
}

const placeholders = (t) => [...new Set([...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];

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

// Joins sentence parts into one template. Required parts always go in; optional parts go in, in order,
// while the filled line stays within maxWords. Returns { template, values } with only the used values.
function compose(parts, all, maxWords) {
  const words = (t) => wordCount(fillLine(t, all).text);
  let used = parts.filter((p) => p.req).reduce((n, p) => n + words(p.t), 0);
  const chosen = parts.filter((p) => {
    if (p.req) return true;
    const w = words(p.t);
    if (used + w > maxWords) return false;
    used += w;
    return true;
  });
  const template = chosen.map((p) => p.t).join(' ');
  const values = Object.fromEntries(placeholders(template).map((k) => [k, all[k]]));
  return { template, values };
}

// Placeholder keys carry a letter, not a digit: templates (and model lines) must stay digit-free.
const L = (i) => String.fromCharCode(65 + i);
const req = (t) => ({ t, req: true });
const opt = (t) => ({ t, req: false });

function scene(id, props, { template, values }, maxWords) {
  for (const k of placeholders(template)) if (!(k in values)) throw new Error(`scene ${id}: no value for {${k}}`);
  return { id, props, values, template, maxWords };
}

// "College Oliver" -> "Oliver"; a label without a child's name gives null.
const childOf = (g) => (/^College\s+\S/i.test(g.label ?? '') ? g.label.replace(/^College\s+/i, '') : null);
const possessive = (names) => (names.length ? `${joinNames(names)}'s` : 'your');

// ---------------------------------------------------------------- up: the dream
function dreamScene(facts, ctx) {
  const { style, maxWords, mainGoal, names } = ctx;
  const all = { names: joinNames(names) };
  const lead = { analytical: '{names}, here is your plan with every goal met.', emotional: '{names}, picture life with every goal met.',
    mixed: '{names}, picture your plan with every goal met.' }[style];

  // Main goal first; the yearly vacation closes the list ("And a ... vacation every year") unless it leads.
  const rest = facts.goals.filter((g) => g.type !== mainGoal);
  const goals = [...facts.goals.filter((g) => g.type === mainGoal), ...rest.filter((g) => g.type !== 'vacation'), ...rest.filter((g) => g.type === 'vacation')];
  const sentences = []; // one per goal type, main goal first
  const seen = new Set();
  let purchaseN = 0;
  for (const g of goals) {
    if (g.type === 'college') {
      if (seen.has('college')) continue;
      seen.add('college');
      const kids = facts.goals.filter((x) => x.type === 'college' && x.year);
      const bits = kids.map((k, i) => {
        all[`kid${L(i)}`] = childOf(k) ?? 'college';
        all[`kidYear${L(i)}`] = String(k.year);
        return childOf(k) ? (i === 0 ? `{kid${L(i)}} starts college in {kidYear${L(i)}}` : `{kid${L(i)}} in {kidYear${L(i)}}`) : `college starts in {kidYear${L(i)}}`;
      });
      if (bits.length) sentences.push(`${bits.join(', ')}.`);
    } else if (g.type === 'retirement') {
      const r = facts.retirement;
      if (!r?.year) continue;
      all.retireYear = String(r.year);
      const ages = Object.entries(r.ages);
      ages.forEach(([n, a], i) => { all[`retiree${L(i)}`] = n; all[`retireAge${L(i)}`] = String(a); });
      if (ages.length >= 2) sentences.push('You both retire in {retireYear}, {retireeA} at {retireAgeA} and {retireeB} at {retireAgeB}.');
      else if (ages.length === 1) sentences.push('You retire in {retireYear}, at {retireAgeA}.');
      else sentences.push('You retire in {retireYear}.');
    } else if (g.type === 'vacation') {
      if (seen.has('vacation') || g.amount === null) continue;
      seen.add('vacation');
      all.vacation = money(g.amount);
      const a = sentences.length ? 'And a' : 'A';
      sentences.push(g.yearly ? `${a} {vacation} vacation every year.` : `${a} {vacation} vacation.`);
    } else if (g.type === 'purchase' && g.year) {
      const i = purchaseN++;
      const what = /vehicle|car/i.test(g.label ?? '') ? 'car' : 'home';
      all[`buyYear${L(i)}`] = String(g.year);
      if (g.amount !== null) {
        all[`buyAmount${L(i)}`] = money(g.amount);
        sentences.push(`You buy your {buyAmount${L(i)}} ${what} in {buyYear${L(i)}}.`);
      } else sentences.push(`You buy your ${what} in {buyYear${L(i)}}.`);
    }
  }
  const parts = [req(lead), ...sentences.map((t, i) => (i === 0 ? req(t) : opt(t)))];
  return scene('dream', { people: names, goals, retirement: facts.retirement }, compose(parts, all, maxWords), maxWords);
}

// ---------------------------------------------------------------- down: reality, gaps, fragility
function realityScene(facts, ctx, offTrack) {
  const { style, maxWords, detail } = ctx;
  const sc = facts.score;
  const [weakPts, weakMax] = String(sc.weakest.points ?? '').split('/');
  const all = { score: String(sc.value), band: sc.band, weakest: sc.weakest.name, weakestPoints: weakPts, weakestMax: weakMax };
  const open = offTrack ? (/^(critical|vulnerable)$/i.test(sc.band) ? "Today, you're not on track for that." : "Today, you're not on track for all of it yet.")
    : "Today, you're on a good path.";
  const score = { analytical: 'Your plan scores {score} out of 100: {band}.', emotional: 'Your plan is {band} right now, at {score} out of 100.',
    mixed: "That's {score} out of 100, which is {band}." }[style];
  const parts = [req(open), req(score)];
  if (detail !== 'low' && weakPts !== undefined && weakMax !== undefined) {
    parts.push(opt(style === 'analytical' ? 'Weakest area: {weakest}, at {weakestPoints} out of {weakestMax}.'
      : "{weakest} is where you're most exposed: {weakestPoints} out of {weakestMax}."));
  }
  const props = { score: sc.value, band: sc.band, colour: sc.colour, weakest: sc.weakest, ...(detail === 'high' ? { pillars: sc.pillars } : {}) };
  return scene('reality', props, compose(parts, all, maxWords), maxWords);
}

// Gap items in story order: main goal, top worry, then retirement, college, cash. Debt only when it is the worry.
function gapItems(facts, ctx) {
  const { mainGoal, worry } = ctx;
  const c = facts.cash;
  const available = {
    college: facts.gaps.college,
    retirement: facts.gaps.retirement,
    cash: c && c.months !== null && c.minMonths !== null && c.maxMonths !== null && c.months < c.minMonths ? c : null,
    debt: worry === 'debt' ? facts.gaps.debt : null,
  };
  const order = [...new Set([mainGoal, worry, 'retirement', 'college', 'cash', 'debt'])].filter((t) => available[t]);
  return order.map((topic) => ({ topic, data: available[topic] }));
}

function gapsScene(facts, ctx, items) {
  const { style, maxWords, detail } = ctx;
  const numFirst = style === 'analytical';
  const shown = items.slice(0, detail === 'high' ? 3 : 2);
  const all = {};
  const lead = { analytical: "Here's how far each goal is.", emotional: "Here's how far you are from that life.", mixed: "Here's how far each goal is today." }[style];
  const kids = facts.goals.filter((g) => g.type === 'college').map(childOf).filter(Boolean);
  const sentences = shown.map(({ topic, data }) => {
    if (topic === 'college') {
      all.collegeGap = money(data.gap);
      const full = detail !== 'low' && data.have !== null;
      const saved = data.have > 0 ? '{collegeHave}' : 'nothing';
      if (full && data.have > 0) all.collegeHave = money(data.have);
      if (numFirst) return full ? `College: ${saved} saved, {collegeGap} still missing.` : 'College: {collegeGap} still missing.';
      const who = kids.length ? `For ${possessive(kids)} college` : 'For college';
      return full ? `${who}, you have ${saved} saved and {collegeGap} still missing.` : `${who}, {collegeGap} is still missing.`;
    }
    if (topic === 'retirement') {
      all.retirementGap = money(data.gap);
      if (facts.noRetirementSaving && detail !== 'low') {
        return numFirst ? 'Retirement: {retirementGap} short, and nothing goes into your retirement accounts today.'
          : "For retirement, nothing goes into your retirement accounts today, so you're {retirementGap} short.";
      }
      return numFirst ? 'Retirement: {retirementGap} short.' : "For retirement, you're {retirementGap} short.";
    }
    if (topic === 'cash') {
      Object.assign(all, { cashMonths: String(data.months), minMonths: String(data.minMonths), maxMonths: String(data.maxMonths) });
      const unit = data.months === 1 ? 'month' : 'months';
      return numFirst ? `Cash: it covers {cashMonths} ${unit}; {minMonths} to {maxMonths} are recommended.`
        : `Your cash covers {cashMonths} ${unit}; {minMonths} to {maxMonths} are recommended.`;
    }
    all.debt = money(data.gap);
    return numFirst ? 'Card debt: {debt}.' : "There's {debt} on the credit card.";
  });
  const parts = [req(lead), ...sentences.map((t, i) => (i === 0 ? req(t) : opt(t)))];
  const composed = compose(parts, all, maxWords);
  // Props carry only the items the line speaks about.
  const spoken = shown.filter((_, i) => composed.template.includes(sentences[i]));
  return scene('gaps', { items: spoken.map(({ topic, data }) => ({ topic, ...data })), noRetirementSaving: facts.noRetirementSaving }, composed, maxWords);
}

function fragilityScene(facts, ctx) {
  const { style, maxWords, detail } = ctx;
  const people = facts.protection;
  const one = people.length === 1;
  const all = {};
  const stops = one ? 'If your paycheck stopped' : 'If one paycheck stopped';
  const who = one ? "life cover is what's left" : 'your family would lean on life cover';
  const lead = { analytical: `${stops}, here is your life cover.`, emotional: `${stops}, ${who}, and today it falls short.`,
    mixed: `${stops}, ${who}.` }[style];
  const lines = people.map((p, i) => {
    all[`person${L(i)}`] = p.name;
    all[`short${L(i)}`] = money(p.shortfall);
    const full = detail !== 'low' && p.cover !== null;
    if (full) all[`cover${L(i)}`] = money(p.cover);
    if (style === 'analytical') return full ? `{person${L(i)}}: {cover${L(i)}}, {short${L(i)}} short.` : `{person${L(i)}}: {short${L(i)}} short.`;
    return full ? `{person${L(i)}} has {cover${L(i)}}, {short${L(i)}} short.` : `{person${L(i)}}'s cover is {short${L(i)}} short.`;
  });
  const parts = [req(lead), ...lines.map(req)];
  return scene('fragility', { people }, compose(parts, all, maxWords), maxWords);
}

// ---------------------------------------------------------------- relief: turn, act, mission
// Risk answers are turned into how the plan moves, never repeated back.
function riskLine(risks) {
  const set = new Set(risks.filter(Boolean));
  if (set.size > 1) return 'You see risk differently, so the plan does both: protect what you have first, then grow it.';
  if (set.has('conservative')) return 'Safety comes first: protect what you have, then grow it.';
  if (set.has('growth')) return 'Protect what you have first, then grow it with confidence.';
  return 'Protect what you have first, then grow it.';
}

function turnScene(facts, ctx) {
  const { style, maxWords, detail, risks } = ctx;
  const all = {};
  const hasFcf = facts.freeCashFlow !== null && facts.freeCashFlow > 0;
  const solution = style === 'emotional' ? 'The good news: this has a solution, one step at a time.' : 'This has a solution, one step at a time.';
  const parts = [req(solution)];
  if (hasFcf) {
    all.freeCashFlow = money(facts.freeCashFlow);
    parts.push(req(style === 'analytical' ? 'You have {freeCashFlow} of free cash flow a year, and the plan sets the order.'
      : 'You have {freeCashFlow} free each year to put to work, and the plan sets the order.'));
  } else parts.push(req('The plan sets the order.'));
  if (detail !== 'low') parts.push(opt(riskLine(risks)));
  return scene('turn', { freeCashFlow: hasFcf ? facts.freeCashFlow : null }, compose(parts, all, maxWords), maxWords);
}

// Links each move to the problem the family just saw. Unknown moves are named by their own title.
function moveLink(m, ctx) {
  if (/mortality|life cover/i.test(m.title) && ctx.shownFragility) return { link: 'fragility', phrase: 'raise your life cover to close the shortfall you just saw' };
  if (/mortality|life cover/i.test(m.title)) return { link: 'protection', phrase: 'raise your life cover' };
  if (/umbrella/i.test(m.title)) return { link: 'protection', phrase: "add umbrella cover to protect what you've built" };
  if (/saving/i.test(m.title) && ctx.shownRetirement) return { link: 'retirement', phrase: 'save more each year to start closing the retirement gap' };
  return { link: null, phrase: null };
}

function actScene(facts, ctx) {
  const { maxWords, detail } = ctx;
  const high = detail === 'high';
  const c = facts.combined;
  // Name what is combined (from the data); with more than two moves, or at low detail, lead with the
  // first move and say the lift comes with the other steps.
  const named = Boolean(c && c.moves.length <= 2 && detail !== 'low');
  const ordered = named
    ? [...facts.moves.filter((m) => c.moves.includes(m.title)), ...facts.moves.filter((m) => !c.moves.includes(m.title))]
    : facts.moves;
  const all = { before: String(facts.moves[0].before), after: String(c ? c.after : facts.moves[0].after) };
  const say = (m, i) => {
    const { phrase } = moveLink(m, ctx);
    if (phrase) return phrase;
    all[`move${L(i)}`] = lowerFirst(m.title);
    return `{move${L(i)}}`;
  };
  const scoreOf = (m, i, first) => {
    all[`before${L(i)}`] = String(m.before);
    all[`after${L(i)}`] = String(m.after);
    return first ? `That takes your score from {before${L(i)}} to {after${L(i)}}.` : `That's {before${L(i)}} to {after${L(i)}}.`;
  };
  const parts = [];
  const firstWord = (i) => ['First, ', 'Then ', 'After that, '][Math.min(i, 2)];
  ordered.forEach((m, i) => {
    const inCombo = named && c.moves.includes(m.title);
    const isReq = i === 0 || inCombo;
    if (i > 0 && !named && c) return; // "with the other steps" covers the rest
    parts.push({ t: `${firstWord(i)}${say(m, i)}.`, req: isReq });
    if (high && (named || !c)) parts.push({ t: scoreOf(m, i, i === 0), req: false });
    if (!c && i === 0 && !high) parts.push(req('It lifts your score from {before} to {after}.'));
    if (named && i === c.moves.length - 1) parts.push(req('Together, your score goes from {before} to {after}.'));
    if (c && !named && i === 0) parts.push(req('With the other steps, your score goes from {before} to {after}.'));
  });
  const composed = compose(parts, all, maxWords);
  const moves = (detail === 'low' ? facts.moves.slice(0, 2) : facts.moves).map((m) => ({ ...m, link: moveLink(m, ctx).link }));
  return scene('act', { moves, combined: c, before: facts.moves[0].before }, composed, maxWords);
}

function missionScene(facts, ctx) {
  const { style, maxWords, mainGoal } = ctx;
  const all = { mission: facts.firstMission };
  const goal = facts.goals.filter((g) => g.type === mainGoal && g.year).sort((a, b) => a.year - b.year)[0];
  let toward = null;
  if (goal) {
    all.dreamYear = String(goal.year);
    if (goal.type === 'college') {
      const kid = childOf(goal);
      if (kid) all.dreamKid = kid;
      toward = kid ? "{dreamKid}'s college in {dreamYear}" : 'college in {dreamYear}';
    } else if (goal.type === 'retirement') toward = 'your retirement in {dreamYear}';
    else if (goal.type === 'vacation') toward = 'your vacation in {dreamYear}';
    else toward = `your new ${/vehicle|car/i.test(goal.label ?? '') ? 'car' : 'home'} in {dreamYear}`;
  }
  const parts = style === 'emotional' && toward
    ? [req(`The road to ${toward} starts here.`), req('Your first mission: {mission}.'), opt('Finish it and your progress bar moves.')]
    : [req('Your first mission: {mission}.'), ...(toward ? [req(`It's the first step toward ${toward}.`)] : []), opt('Finish it and your progress bar moves.')];
  return scene('mission', { mission: facts.firstMission, year: goal?.year ?? null, goal: goal?.type ?? null }, compose(parts, all, maxWords), maxWords);
}

// Entry point: facts + profile -> the list of scenes for this family.
export function planScenes(facts, profile) {
  const names = profile.present?.length ? profile.present : facts.people;
  const detail = MAX_WORDS[profile.detail_level] ? profile.detail_level : 'medium';
  const ctx = {
    names, detail,
    style: styleOf(names, profile),
    maxWords: MAX_WORDS[detail],
    mainGoal: profile.main_goal?.agreed,
    worry: profile.top_worry?.agreed,
    risks: names.map((n) => profile.people?.[n]?.risk),
  };
  const items = gapItems(facts, ctx);
  const gapsShown = items.slice(0, detail === 'high' ? 3 : 2);
  ctx.shownFragility = facts.protection.length > 0;
  ctx.shownRetirement = gapsShown.some((i) => i.topic === 'retirement');

  const scenes = [dreamScene(facts, ctx), realityScene(facts, ctx, items.length > 0 || ctx.shownFragility)];
  if (items.length) scenes.push(gapsScene(facts, ctx, items));
  if (ctx.shownFragility) scenes.push(fragilityScene(facts, ctx));
  scenes.push(turnScene(facts, ctx));
  if (facts.moves.length) scenes.push(actScene(facts, ctx));
  if (facts.firstMission) scenes.push(missionScene(facts, ctx));
  return scenes;
}
