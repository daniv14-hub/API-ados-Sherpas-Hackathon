// What Sherpy knows about the missions screen in the "Ask Sherpy" chat: every mission with its steps and facts,
// numbered as the family sees them, and which screen they are on. Figures come from the missions data only.
import { formatFact, orderedMissions } from '../public/missions-logic.mjs';

const VIEWS = new Set(['overview', 'mission', 'checkpoint']);
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// view = the GET /missions/<case> body (missionsView).
export function missionsBrief(view) {
  return orderedMissions(view).map((m, i) => {
    const lines = [`Mission ${i + 1}: "${oneLine(m.title)}"`];
    const facts = (m.facts ?? []).map((f) => `${oneLine(f.label)}: ${formatFact(f)}`);
    if (facts.length) lines.push(`  Facts: ${facts.join('; ')}`);
    (m.steps ?? []).forEach((s, j) => lines.push(`  Step ${j + 1}: "${oneLine(s.title)}". ${oneLine(s.body)}`));
    return lines.join('\n');
  }).join('\n') + moreAdvice(view.keepInView);
}

// The plan's other advice (not a mission): Sherpy knows all of it.
function moreAdvice(items) {
  if (!items?.length) return '';
  const line = (k) => {
    const facts = (k.facts ?? []).map((f) => `${oneLine(f.label)}: ${formatFact(f)}`);
    return `- ${oneLine(k.body)}${facts.length ? ` (${facts.join('; ')})` : ''}`;
  };
  return `\nMORE ADVICE FROM THEIR PLAN (shown under "More advice from your plan"; not a mission, nothing to do now):\n${items.map(line).join('\n')}`;
}

// Untrusted page input -> { view, mission, done } with known ids only, or null.
export function parseScreen(raw, view) {
  if (!raw || typeof raw !== 'object' || !VIEWS.has(raw.view)) return null;
  const mission = view.missions.find((m) => m.id === raw.mission) ?? null;
  const stepIds = new Set(view.missions.flatMap((m) => m.steps.map((s) => s.id)));
  const done = Array.isArray(raw.done) ? raw.done.filter((id) => typeof id === 'string' && stepIds.has(id)).slice(0, 200) : [];
  if (!mission) return { view: 'overview', mission: null, done };
  return { view: raw.view, mission: mission.id, done };
}

export function screenText(screen, view) {
  const ordered = orderedMissions(view);
  const num = new Map(ordered.map((m, i) => [m.id, i + 1]));
  const m = ordered.find((x) => x.id === screen.mission);
  const where = !m || screen.view === 'overview' ? 'They are on the missions map.'
    : screen.view === 'checkpoint' ? `They just completed mission ${num.get(m.id)}: "${oneLine(m.title)}".`
      : `They have mission ${num.get(m.id)} open: "${oneLine(m.title)}".`;
  const done = new Set(screen.done);
  const marks = ordered.flatMap((x) => x.steps.map((s, j) => (done.has(s.id) ? `mission ${num.get(x.id)} step ${j + 1}` : null)).filter(Boolean));
  return `${where} ${marks.length ? `Steps marked done: ${marks.join(', ')}.` : 'No steps marked done yet.'}`;
}
