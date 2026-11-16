import { personaSections } from './persona.mjs';

const PERSONA_SECTIONS = [/^D4\b/, /^D5\b/, /^D6\b/, /^Objective concerns/, /^Tensions/];
const json = (v) => JSON.stringify(v);

// Family brief for the voice agent. Every value is copied verbatim from the sources
// (JSON.stringify / Markdown text); labels contain no digits. Nothing is computed.
export function buildBrief(fh, personaMd) {
  const parts = [
    `case.household: ${json(fh.case.household)}`,
    'score:',
    `  published_score: ${json(fh.score.published_score)}`,
    `  band: ${json(fh.score.band)}`,
    `  message: ${json(fh.score.message)}`,
    `  pillars: ${json(fh.score.pillars)}`,
    `  top_moves: ${json(fh.score.top_moves)}`,
    `  combined_moves: ${json(fh.score.combined_moves)}`,
    `goals.goalsSummary: ${json(fh.goals.goalsSummary)}`,
    'profile:',
    ...['incomes', 'expenses', 'accounts', 'liabilities', 'insurance', 'goals'].map(
      (k) => `  ${k}: ${json(fh.profile[k])}`,
    ),
    `narrative.summary_main: ${json(fh.narrative.summary_main)}`,
    `narrative.summary_recommendations: ${json(fh.narrative.summary_recommendations)}`,
  ];
  const sections = personaSections(personaMd).filter((s) => PERSONA_SECTIONS.some((re) => re.test(s.heading)));
  for (const s of sections) parts.push(`persona section:\n${s.text}`);
  return parts.join('\n');
}
