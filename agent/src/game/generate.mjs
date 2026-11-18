// Mission generator v2, minimal version (design: docs/superpowers/specs/2026-11-18-mission-generator-design.md,
// team 18/11: "like the Johnsons", every topic of the catalogue present in the case is its own mission).
// Used for every case without a hand-written data/missions/<case>.json (the Johnsons keep theirs).
// Rules: every number shown comes from the case JSON (facts carry their src) or is the plan's own advice text;
// template wording has no digits; every advice item ends in exactly one mission or in "More advice".
import { adviceRef } from './advice.mjs';

// ---------- topics ----------
// Checked in this order: a shared cash-flow decision first, then past-market notes (investing), then tax accounts,
// then the topic named first in the text.
const DECISION = /compete|share (your|the)|should share|weigh|trade-?off|talk (it )?through|fit together|fits? alongside|both draw|same (yearly )?cash/i;
// Keyword rules. Each advice sentence is classified into ONE topic of the catalogue (life cover,
// property/umbrella, the shared cash-flow decision, cash, retirement, tax accounts, debt, college, investing).
// Sentences about how the portfolio behaved in past markets belong to the investing mission.
const PAST_MARKETS = /rally|tariff|pullback|three years|recoveries|shocks?\b|sharpest|smoother|calmer|held up|steady through|earned about|fair picture|real market events/i;
const TAX = /\bhsa\b|health savings|\bira\b|roth|\btax/i;
const NAMED = [
  ['life', /life (cover|insurance)|mortality|disability/i],
  ['property', /umbrella|homeowners|home and auto|auto insurance|liability|coverage gap|property/i],
  ['college', /college|529|education/i],
  ['debt', /credit card|\bcard\b|revolving|debt/i],
  ['retirement', /retire|401\(k\)|withdraw|workplace (retirement )?plan|social security|pension|annuit/i],
  ['cash', /\bcash\b|liquidity|cushion|reserve|emergency|purchase/i],
  ['invest', /invest|portfolio|stocks?\b|bonds?\b|\bmix\b|allocation|concentrat|exposure|single-name|\brisk\b/i],
];

// Text of one advice item -> topic key, or null (then it goes to 'More advice from your plan').
export function topicOf(text) {
  const t = String(text ?? '');
  if (DECISION.test(t)) return 'decision';
  if (PAST_MARKETS.test(t)) return 'invest';
  const hits = NAMED.map(([k, re]) => [k, t.search(re)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
  if (TAX.test(t) && !(hits[0] && hits[0][1] < t.search(TAX) && ['life', 'property'].includes(hits[0][0]))) return 'tax';
  return hits[0]?.[0] ?? null;
}

// Maps each scored move of the plan (score.top_moves) to its topic, so its mission shows the score change.
const MOVE_TOPIC = [[/mortality|life/i, 'life'], [/umbrella|coverage gap|property/i, 'property'], [/card|revolving|debt/i, 'debt'],
  [/withdraw|saving/i, 'retirement'], [/allocation|glide|concentrat/i, 'invest'], [/cash|reserve|liquid/i, 'cash']];
const moveTopic = (title) => MOVE_TOPIC.find(([re]) => re.test(title))?.[1] ?? null;

// Fixed template wording per topic (no digits). phase: order in the path (handoff §4).
const T = {
  life: { title: 'Protect the family: life cover', phase: 'first', perPerson: true, learn: 'See what your plan says about your life cover',
    why: 'If an income stopped, life cover is what keeps the family on track. Here is what your plan says about it.',
    fields: [{ key: 'insurer', label: 'Insurer' }, { key: 'amount', label: 'Amount it pays out', kind: 'usd' }, { key: 'type', label: 'Type of policy' }],
    prepare: 'Find your current life policy', done: 'Choose your cover and apply' },
  property: { title: 'Shield what you own: umbrella and property cover', phase: 'first', learn: 'See what a claim could reach',
    why: 'Home, auto and umbrella cover protect what you have built from a large claim. Here is what your plan says.',
    fields: [{ key: 'policies', label: 'Policies you have today (home, auto, umbrella)' }, { key: 'limits', label: 'Their liability limits' }],
    prepare: 'Find your home, auto and umbrella policies', done: 'Put the cover in place' },
  decision: { title: 'Decide together where your cash flow goes', phase: 'decision', learn: 'See the needs that share the same money',
    why: 'Several needs draw on the same money. Your plan does not settle which comes first, so it is your choice.' },
  cash: { title: 'Build your cushion: cash reserve', learn: 'See what your plan says about your cash',
    why: 'A cash reserve covers a lost paycheck or a big bill without selling investments at a bad time.',
    fields: [{ key: 'where', label: 'Where your cash is kept' }, { key: 'amount', label: 'Amount you can reach quickly', kind: 'usd' }],
    prepare: 'Check the cash you can reach today', done: 'Set your cash plan in motion' },
  retirement: { title: 'Pay your future self: retirement', perPerson: true, learn: 'See what your plan says about retirement',
    why: 'Retirement is the longest goal in your plan, and small steps now make the biggest difference.',
    fields: [{ key: 'account', label: 'Retirement accounts you have' }, { key: 'contribution', label: 'What goes in today, per year', kind: 'usd' }],
    prepare: 'Check what goes into retirement today', done: 'Make the change in your accounts' },
  tax: { title: 'Use your tax-advantaged accounts', learn: 'See which accounts your plan mentions',
    why: 'Some accounts lower the tax you pay while you save. Your plan names the ones that may be open to you.',
    fields: [{ key: 'accounts', label: 'Tax-advantaged accounts you have or qualify for' }],
    prepare: 'Check which accounts you can use', done: 'Open or fund the account' },
  debt: { title: 'Keep your debt in check', learn: 'See what your plan says about debt',
    why: 'Debt, and high-rate debt most of all, costs you every month. Here is what your plan says about yours.',
    fields: [{ key: 'balance', label: 'Balance today', kind: 'usd' }, { key: 'payment', label: 'Monthly payment', kind: 'usd' }],
    prepare: 'Check your balance and payment', done: 'Change your payment' },
  college: { title: 'Plan for college', learn: 'See where the college fund stands',
    why: 'College dates are fixed, so the plan looks at what is saved and what is still missing.',
    fields: [{ key: 'account', label: 'College savings account' }, { key: 'yearly', label: 'What goes in per year', kind: 'usd' }],
    prepare: 'Check your college savings', done: 'Set your college contribution' },
  invest: { title: 'Invest toward your target mix', phase: 'last', learn: 'See your mix next to the plan',
    why: 'Your plan compares how your money is invested with the mix it recommends. Past results are not a promise.',
    fields: [{ key: 'accounts', label: 'Accounts to review' }],
    prepare: 'Get ready to review your mix', done: 'Make the change after your review' },
};
// Fixed order of topics on the path, and the labels used when the family ranks their needs.
const ORDER = ['life', 'property', 'decision', 'cash', 'retirement', 'tax', 'debt', 'college', 'invest'];
const NEED_LABEL = { life: 'Protection: life cover', property: 'Protection: umbrella and property', cash: 'The cash reserve',
  retirement: 'Retirement saving', tax: 'Tax-advantaged accounts', debt: 'Paying down debt', college: 'The college fund' };

// ---------- facts (value + where it comes from) ----------
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// Plan figures shown in a mission. Every fact keeps `src`, the JSON path it comes from, and tests check
// each value against the case file: nothing is computed or invented here.
function factsFor(topic, fh, people, move, moveIndex) {
  const f = [];
  const add = (key, label, value, fmt, src) => { if (value !== null && value !== undefined && value !== '') f.push({ key, label, value, fmt, src }); };
  const r = fh.key_metrics?.ratios ?? {};
  if (move) {
    add('score', 'Plan score today, and after this move', `${move.score_before} to ${move.score_after}`, 'text', `FH: score.top_moves[${moveIndex}]`);
    // target_amount is not shown: in Weah it disagrees with the move's own action text ($485,000 vs "Add $235,000").
    // The action is quoted word for word in the act step instead.
  }
  if (topic === 'life') {
    const li = r.lifeInsurance, g = li?.lifeInsuranceCoverageGapsAndExcess ?? {};
    [['client', 'clientCoverage', 'clientShortfall'], ['coClient', 'coClientCoverage', 'coClientShortfall']].forEach(([, cov, sh], i) => {
      if (!people[i] || !li) return;
      add(`cover_${i}`, `${people[i]}'s life cover today`, num(li[cov]) !== null ? Math.round(li[cov]) : null, 'usd', `FH: key_metrics.ratios.lifeInsurance.${cov}`);
      if (num(g[sh]) > 0) add(`short_${i}`, `${people[i]}'s cover the plan says is missing`, Math.round(g[sh]), 'usd', `FH: key_metrics.ratios.lifeInsurance.lifeInsuranceCoverageGapsAndExcess.${sh}`);
    });
  }
  if (topic === 'cash' || topic === 'decision') {
    const ef = r.emergencyFund;
    if (topic === 'cash' && ef) {
      add('cash_have', 'Accessible cash today', num(ef.emergencyFund) !== null ? Math.round(ef.emergencyFund) : null, 'usd', 'FH: key_metrics.ratios.emergencyFund.emergencyFund');
      if (num(ef.minRecommendedEFMonths) !== null && num(ef.maxRecommendedEFMonths) !== null) add('cash_target', 'Months of expenses the plan recommends', `${ef.minRecommendedEFMonths} to ${ef.maxRecommendedEFMonths}`, 'text', 'FH: key_metrics.ratios.emergencyFund.min/maxRecommendedEFMonths');
    }
    const fcf = num(fh.key_metrics?.cashflowStatement?.freeCashflow?.total);
    if (fcf !== null) add('fcf', 'Free cash flow per year', Math.round(fcf), 'usd', 'FH: key_metrics.cashflowStatement.freeCashflow.total');
  }
  if (topic === 'retirement') {
    const rs = r.retirementSavings ?? {};
    if (num(rs.requiredExtraSavings) > 0) add('ret_extra', 'Extra saving the plan calls for, per year', Math.round(rs.requiredExtraSavings), 'usd', 'FH: key_metrics.ratios.retirementSavings.requiredExtraSavings');
    if (num(rs.planningGapAtRetirementAgeInTodaysDollars) > 0) add('ret_gap', "Retirement gap (today's dollars)", Math.round(rs.planningGapAtRetirementAgeInTodaysDollars), 'usd', 'FH: key_metrics.ratios.retirementSavings.planningGapAtRetirementAgeInTodaysDollars');
  }
  return f;
}

// ---------- steps ----------
const stepId = (m, n) => `${m}-${n}`;
// Builds the 3-4 steps of a mission: learn (the plan's own words), prepare (write down what you have),
// act (tick what the plan recommends; amounts agreed in the decision are shown), close. The decision
// mission instead has rank (each person) and agree (shared order + optional amounts).
function missionSteps(id, topic, t, items, move, owner, perPerson, decisionNeeds, hasDecision) {
  const steps = [];
  const quotes = { kind: 'quotes', items: items.map((x) => x.text) };
  steps.push({ id: stepId(id, 1), type: 'learn', owner: 'together', title: t.learn, body: t.why, kit: null, ui: [quotes] });
  if (topic === 'decision') {
    steps.push({ id: stepId(id, 2), type: 'decide', owner: owner === 'you' ? 'you' : 'each', title: 'Put the needs in your own order',
      body: owner === 'you' ? 'Put the needs in the order you would choose.' : 'Each of you, on your own, puts the needs in the order you would choose. It is fine if your orders differ.',
      kit: null, ui: [{ kind: 'rank', title: 'First = most important to you', items: decisionNeeds }] });
    steps.push({ id: stepId(id, 3), type: 'decide', owner: owner === 'you' ? 'you' : 'together', title: 'Set your order, and optionally an amount for each',
      body: 'Any amount you pick is your own number, not the plan\'s.', kit: null, ui: [{ kind: 'agree', rankStep: stepId(id, 2), total: 'fcf' }] });
    return steps;
  }
  const per = perPerson && owner !== 'you' ? 'each' : 'together';
  steps.push({ id: stepId(id, 2), type: 'prepare', owner: per === 'each' ? 'each' : owner, title: t.prepare,
    body: 'Write down what you have today, so the next step starts from your real numbers.', kit: null,
    ui: [{ kind: 'fields', per, title: 'Write down what you find', fields: t.fields }] });
  const actUi = [];
  if (hasDecision && NEED_LABEL[topic]) actUi.push({ kind: 'agreed', need: topic, label: `for ${NEED_LABEL[topic].toLowerCase()}` });
  actUi.push({ kind: 'recall', step: stepId(id, 2), title: 'What you have today (from step 2)' });
  // Each thing the plan recommends becomes a tick: the move's own action, then the plan's advice for this topic.
  const ticks = [];
  if (move?.action) ticks.push({ text: move.action });
  for (const it of items.slice(0, 4)) ticks.push({ text: shortLine(it.text) });
  actUi.push({ kind: 'checklist', title: 'What your plan recommends: tick each one you have done', items: ticks.length ? ticks : [{ text: 'Done what the plan says above' }] });
  steps.push({ id: stepId(id, 3), type: 'act', owner, title: t.done, body: 'Do it in your own accounts or with your provider, then tick it here.', kit: null, ui: actUi });
  steps.push({ id: stepId(id, 4), type: 'close', owner, title: 'Mark the mission done',
    body: 'Note what you did, for your next check-in. Tap "I did it" when it is in place. That is the checkpoint.', kit: null,
    ui: [{ kind: 'fields', per: 'together', optional: true, title: 'What you did (optional)', fields: [{ key: 'note', label: 'Note' }] }] });
  return steps;
}

// The plan's headline when it has one ("Headline — details"), else the full sentence.
const shortLine = (text) => { const i = String(text).indexOf(' — '); return i > 0 && i < 90 ? text.slice(0, i) : text; };

// fh: financial-health JSON; advice: listAdvice() items. -> { missions, keepInView }
export function generateMissions(fh, advice) {
  const people = (fh.case?.household ?? []).filter((p) => p.role === 'client' || p.role === 'co-client').map((p) => p.first_name).filter(Boolean);
  const couple = people.length > 1;
  const owner = couple ? 'together' : 'you';
  const moves = fh.score?.top_moves ?? [];
  const byTopic = new Map();
  const rest = [];
  for (const item of advice) {
    const t = topicOf(item.text);
    if (t && T[t]) (byTopic.get(t) ?? byTopic.set(t, []).get(t)).push(item);
    else rest.push(item);
  }
  const movesByTopic = new Map();
  moves.forEach((m, i) => { const t = moveTopic(m.title); if (t && !movesByTopic.has(t)) movesByTopic.set(t, { m, i }); });
  const topics = ORDER.filter((t) => byTopic.has(t) || movesByTopic.has(t));
  const hasDecision = topics.includes('decision');
  // Needs to rank in the decision: the other topics present that draw on cash flow.
  const needs = topics.filter((t) => NEED_LABEL[t]).map((t) => ({ key: t, label: NEED_LABEL[t] }));

  const missions = topics.map((topic, n) => {
    const id = `G${n + 1}`;
    const t = T[topic];
    const mv = movesByTopic.get(topic);
    const items = byTopic.get(topic) ?? [];
    const facts = factsFor(topic, fh, people, mv?.m, mv?.i);
    const steps = missionSteps(id, topic, t, items, mv?.m, owner, !!t.perPerson && couple, needs, hasDecision);
    // Plan figures for the learn step, when the topic has a pair worth seeing side by side.
    // Bars only where the figures compare like for like: each person's life cover and what the plan says is missing.
    const bars = topic === 'life' ? facts.filter((f) => /^(cover|short)_/.test(f.key)).map((f) => ({ label: f.label, fact: f.key })) : [];
    if (bars.length) steps[0].ui.push({ kind: 'bars', rows: bars });
    if (topic === 'decision' && !(facts.find((f) => f.key === 'fcf')?.value > 0)) delete steps[2].ui[0].total; // no margin to compare with
    return {
      id, title: topic === 'decision' && !couple ? 'Decide where your cash flow goes' : t.title, kind: couple ? (t.perPerson ? 'individual' : 'joint') : 'individual', phase: t.phase ?? 'competing',
      effort: mv?.m.effort ?? null, moveTitle: mv?.m.title ?? null,
      scoreNote: mv ? null : 'This mission does not move the Sherpas score. It follows your plan\'s advice.',
      facts, steps, adviceRefs: items.map(adviceRef),
    };
  });
  const keepInView = rest.map((item, i) => ({ id: `K${i + 1}`, title: item.text.split(/[:—.]/)[0].slice(0, 80).trim(), body: item.text, facts: [], adviceRefs: [adviceRef(item)] }));
  return { missions, keepInView };
}
