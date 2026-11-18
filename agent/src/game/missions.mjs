// Loads the missions of a case. If data/missions/<case>.json exists (the Johnsons), that hand-written
// file is used as is; otherwise generate.mjs builds them from the plan's three advice sources.
// Also orders missions: protection first, then the shared cash-flow decision, then the rest, investing last.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { listAdvice, adviceRef } from './advice.mjs';
import { buildScoreTable } from './score.mjs';
import { generateMissions } from './generate.mjs';

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

// -> { caseId, base score, score table, missions, keepInView (more advice), order, source }.
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
  const { missions, keepInView } = generateMissions(fh, await listAdvice(source, caseId));
  return { caseId, base: table.base, table, missions, keepInView, order: orderMissions(missions).map((m) => m.id), source: 'derived' };
}
