import { applyAnswer, missingTopics, saveProfile } from './profile.mjs';

// Whitelisted plan lookups. Empty list = the whole part, no section.
export const SECTIONS = {
  'financial-health': ['narrative', 'key_metrics', 'projections', 'goals', 'profile', 'score'],
  'investment-analysis': ['narrative', 'key_metrics', 'analysis', 'positions'],
  persona: [],
};

const QUESTIONS = ['present', 'main_goal', 'top_worry', 'risk', 'style', 'detail_level'];
const MAX_CHARS = 20000;

const values = (list) => list.map((o) => (typeof o === 'object' ? o.value : o));

function allowedFor(question, options) {
  return QUESTIONS.includes(question) ? values(options[question] ?? []) : QUESTIONS;
}

function saveAnswerTool(options) {
  const names = options.present.join(', ');
  const valueLines = [
    `present: the first names present, separated by commas, from: ${names}`,
    ...QUESTIONS.slice(1).map((k) => `${k}: one of ${values(options[k]).join(', ')}`),
  ];
  return {
    type: 'function',
    name: 'save_answer',
    description: "Save one answer from the family to their profile. Call it after each answer, with the exact option value.",
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', enum: QUESTIONS, description: 'Which question was answered.' },
        person: {
          type: 'string',
          description: `Who answered. Exactly one of: ${names}, household. Use "household" for present, detail_level, and agreed main_goal or top_worry. Use a first name for risk, style, and a single partner's main_goal or top_worry.`,
        },
        value: {
          type: 'string',
          description: `The exact option value, lowercase, no other words. Accepted values per question: ${valueLines.join('; ')}.`,
        },
      },
      required: ['question', 'person', 'value'],
    },
  };
}

function planSectionTool() {
  const parts = Object.keys(SECTIONS);
  const all = [...new Set(Object.values(SECTIONS).flat())];
  const perPart = parts
    .map((p) => `${p}: ${SECTIONS[p].length ? SECTIONS[p].join(', ') : 'no section (whole part)'}`)
    .join('; ');
  return {
    type: 'function',
    name: 'get_plan_section',
    description: "Look up a section of the family's Sherpas plan that is not in the brief. Answer only from what it returns.",
    parameters: {
      type: 'object',
      properties: {
        part: { type: 'string', enum: parts, description: `Exactly one of: ${parts.join(', ')}.` },
        section: {
          type: 'string',
          enum: all,
          description: `Exactly one section of that part. Valid sections per part: ${perPart}.`,
        },
      },
      required: ['part'],
    },
  };
}

const FINISH_TOOL = {
  type: 'function',
  name: 'finish_conversation',
  description: 'Call this once, right after saying the closing line, when every topic is saved. It ends the call and shows the family their video.',
  parameters: { type: 'object', properties: {} },
};

// phase 1 = profile incomplete: the getting-to-know-you conversation, which ends with the video (D19).
// phase 2 = profile complete: plan lookups only (after the video).
export function toolDefinitions(phase, options) {
  if (phase === 1) return [saveAnswerTool(options), FINISH_TOOL];
  if (phase === 2) return [planSectionTool()];
  throw new Error(`unknown phase: ${phase}`);
}

function parseArgs(argsJson) {
  try {
    const a = JSON.parse(argsJson);
    return a !== null && typeof a === 'object' && !Array.isArray(a) ? a : null;
  } catch {
    return null;
  }
}

async function saveAnswer(args, ctx) {
  if (!args) return { output: { ok: false, error: 'invalid_arguments', allowed: QUESTIONS } };
  const { question, person, value } = args;
  const r = applyAnswer(ctx.profile, { question, person, value }, ctx.options);
  if (!r.ok) return { output: { ok: false, error: r.error, allowed: allowedFor(question, ctx.options) } };
  await saveProfile(ctx.profilesDir, r.profile);
  return {
    output: { ok: true, saved: { question, person, value }, phase1Complete: r.profile.phase1Complete },
    profile: r.profile,
  };
}

function capped(part, section, data) {
  const base = section === undefined ? { part } : { part, section };
  const out = { ...base, data };
  if (JSON.stringify(out).length <= MAX_CHARS) return out;
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  const shell = JSON.stringify({ ...base, data: '', truncated: true }).length;
  // JSON escaping can grow the text; shrink until the whole output fits.
  let n = MAX_CHARS - shell;
  let cut = { ...base, data: text.slice(0, n), truncated: true };
  while (JSON.stringify(cut).length > MAX_CHARS) {
    n -= JSON.stringify(cut).length - MAX_CHARS;
    cut = { ...base, data: text.slice(0, n), truncated: true };
  }
  return cut;
}

async function getPlanSection(args, ctx) {
  if (!args) return { output: { error: 'invalid_arguments' } };
  const { part, section } = args;
  if (!Object.hasOwn(SECTIONS, part)) return { output: { error: 'unknown_part', allowed: Object.keys(SECTIONS) } };
  const allowed = SECTIONS[part];
  const wanted = section === '' || section === null ? undefined : section;
  if (allowed.length === 0 && wanted !== undefined) {
    return { output: { error: 'section_not_allowed', allowed: [] } };
  }
  if (allowed.length > 0 && !allowed.includes(wanted)) return { output: { error: 'unknown_section', allowed } };
  try {
    const data = await ctx.source.getPart(ctx.caseId, part, wanted);
    return { output: capped(part, wanted, data) };
  } catch (e) {
    // Any failure means Sherpy must not answer from memory. Log only the error, never case data or tokens.
    console.error('get_plan_section failed:', e?.name, e?.message);
    return { output: { error: 'plan_unavailable' } };
  }
}

export async function handleToolCall(name, argsJson, ctx) {
  const args = parseArgs(argsJson);
  if (name === 'save_answer') return saveAnswer(args, ctx);
  if (name === 'get_plan_section') return getPlanSection(args, ctx);
  if (name === 'finish_conversation') {
    const missing = missingTopics(ctx.profile);
    if (missing.length) return { output: { ok: false, error: 'not_finished', missing } };
    return { output: { ok: true, finished: true }, finished: true };
  }
  return { output: { error: `unknown_tool: ${name}` } };
}
