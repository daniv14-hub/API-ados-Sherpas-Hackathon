import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { listAdvice, adviceRef } from './advice.mjs';
import { buildScoreTable } from './score.mjs';

const DEFAULT_DIR = new URL('../../data/missions/', import.meta.url);

// Handoff §4 distribution. Missions carry a `phase`: 'first' (plan-stated order, e.g. protection), 'decision' (the shared
// cash-flow decision), 'competing' (draw on the same cash: ordered by the family's choice, else the given order), 'last'.
// `choice` is an array of mission ids (the family's order for the competing ones); unknown ids are ignored.
export function orderMissions(missions, choice) {
  const phase = (m) => m.phase ?? 'competing';
  const pick = (p) => missions.filter((m) => phase(m) === p);
  const competing = pick('competing');
  const chosen = (choice ?? []).map((id) => competing.find((m) => m.id === id)).filter(Boolean);
  const chosenSet = new Set(chosen.map((m) => m.id));
  return [...pick('first'), ...pick('decision'), ...chosen, ...competing.filter((m) => !chosenSet.has(m.id)), ...pick('last')];
}

// Which advice text belongs to which move (derived missions only). First match wins.
const TOPICS = [
  [/mortality|life/i, /life|mortality|insurance/i],
  [/umbrella/i, /umbrella/i],
  [/coverage gap/i, /insur|coverage|cover\b/i],
  [/card|revolving/i, /card|credit|debt/i],
  [/withdrawal/i, /withdraw|retirement/i],
  [/savings/i, /retire|saving|401/i],
  [/concentration/i, /concentrat|exposure/i],
  [/allocation|glide/i, /allocation|mix|stock|growth/i],
];
const topicOf = (title) => TOPICS.find(([t]) => t.test(title))?.[1] ?? null;

function derive(fh, advice) {
  const moves = fh.score?.top_moves ?? [];
  const joint = (fh.profile?.incomes?.length ?? 1) > 1;
  const owner = joint ? 'together' : 'you';
  const matched = new Map(moves.map((m) => [m.title, []]));
  const unmatched = [];
  for (const item of advice) {
    const move = moves.find((m) => topicOf(m.title)?.test(item.text));
    (move ? matched.get(move.title) : unmatched).push(item);
  }
  const missions = moves.map((m, i) => {
    const items = matched.get(m.title);
    const facts = [
      { label: 'Plan score today, and after this move', value: `${m.score_before} to ${m.score_after}`, fmt: 'text', src: `FH: score.top_moves[${i}]`, verify: 'exists' },
    ];
    if (m.effort) facts.push({ label: 'Effort the plan estimates', value: m.effort, fmt: 'text', src: `FH: score.top_moves[${i}].effort` });
    if (typeof m.target_amount === 'number' && m.target_amount > 0) {
      facts.push({ label: 'Amount in the plan\'s move', value: Math.round(m.target_amount), fmt: 'usd', src: `FH: score.top_moves[${i}].target_amount` });
    }
    return {
      id: `D${i + 1}`, title: m.title, kind: joint ? 'joint' : 'individual', phase: 'competing', effort: m.effort ?? null,
      moveTitle: m.title, scoreNote: null, facts,
      steps: [
        { id: `D${i + 1}-1`, type: 'learn', owner, title: 'See what the plan says', kit: null,
          body: items.length ? items[0].text : `The plan\'s next move: ${m.action}.` },
        { id: `D${i + 1}-2`, type: 'act', owner, title: m.action, kit: null,
          body: 'This is the move from your plan. Do it in your own accounts, then come back and tap "I did it".' },
        { id: `D${i + 1}-3`, type: 'close', owner, title: 'Mark it done', kit: null,
          body: 'Tap "I did it" when it is in place. That is the checkpoint.' },
      ],
      adviceRefs: items.map(adviceRef),
    };
  });
  const keepInView = unmatched.map((item, i) => ({
    id: `K${i + 1}`, title: item.text.split(/[:—.]/)[0].slice(0, 80).trim(), body: item.text, facts: [], adviceRefs: [adviceRef(item)],
  }));
  return { missions, keepInView };
}

export async function loadMissions(source, caseId, { dir = DEFAULT_DIR } = {}) {
  const fh = await source.getPart(caseId, 'financial-health');
  const table = buildScoreTable(fh);
  let hand = null;
  try {
    hand = JSON.parse(await readFile(new URL(`${caseId}.json`, dir instanceof URL ? dir : pathToFileURL(`${dir}/`)), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (hand) {
    return { caseId, base: table.base, table, missions: hand.missions, keepInView: hand.keepInView ?? [], order: hand.order ?? hand.missions.map((m) => m.id), source: 'handwritten' };
  }
  const { missions, keepInView } = derive(fh, await listAdvice(source, caseId));
  return { caseId, base: table.base, table, missions, keepInView, order: missions.map((m) => m.id), source: 'derived' };
}
