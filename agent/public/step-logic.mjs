// Pure logic of the interactive mission steps (no DOM, no storage). A step may carry `ui`: a list of blocks
// (bars, fields, checklist, email, rank, agree, choice, agreed, recall). What the family enters lives in
// answers[stepId][blockIndex][who], who = a first name, or "_" for something they do together.
// Nothing here makes up a plan figure: facts are only formatted, and the one sum adds the family's own amounts.
import { formatFact, usd } from './missions-logic.mjs';

export const TOGETHER = '_';

// "Daniel & Emily Johnson" -> ["Daniel", "Emily"]; "Michael Carter" -> ["Michael"].
export function peopleOf(label) {
  const parts = String(label ?? '').split('&').map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => p.split(/\s+/)[0]);
}

// Who fills a block in: each person (or only the step's owner when it is one person), or the family together.
export function whoFor(step, block, people) {
  if (block.per !== 'each' && !['rank', 'email'].includes(block.kind)) return [TOGETHER];
  return people.includes(step.owner) ? [step.owner] : people;
}

const filled = (v) => (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v.trim() !== '');

export function blockReady(step, block, i, answers, people) {
  const a = answers?.[step.id]?.[i] ?? {};
  const who = whoFor(step, block, people);
  switch (block.kind) {
    case 'fields': return !!block.optional || who.every((w) => block.fields.every((f) => filled(a[w]?.[f.key])));
    case 'checklist': return block.items.every((_, j) => a[TOGETHER]?.[j] === true);
    case 'email': return who.every((w) => (block.questions ?? []).every((q) => filled(a[w]?.[q.key])));
    case 'rank': return who.every((w) => a[w]?.saved === true);
    case 'agree': return a[TOGETHER]?.saved === true;
    case 'choice': {
      const c = a[TOGETHER];
      return c?.pick === 'keep' || (c?.pick === 'more' && Number(c.amount) > 0);
    }
    default: return true; // bars, agreed, recall only show things
  }
}

// Can the family mark this step done? (Every block that asks for something has it.)
export function stepReady(step, answers, people) {
  return (step.ui ?? []).every((b, i) => blockReady(step, b, i, answers, people));
}

// The yearly amount the family agreed for one need in the cash flow decision (the "agree" block), or null.
export function agreedAmount(data, answers, need) {
  for (const m of data.missions) {
    for (const s of m.steps) {
      const i = (s.ui ?? []).findIndex((b) => b.kind === 'agree');
      if (i < 0) continue;
      const v = answers?.[s.id]?.[i]?.[TOGETHER];
      const n = v?.saved ? v.amounts?.[need] : null;
      return typeof n === 'number' && n > 0 ? n : null;
    }
  }
  return null;
}

export const sumAmounts = (amounts) => Object.values(amounts ?? {}).filter((n) => typeof n === 'number' && Number.isFinite(n)).reduce((a, b) => a + b, 0);

// "$1,600,000" -> 1600000; anything without digits -> null.
export function parseUsd(text) {
  const d = String(text ?? '').replace(/[^\d.]/g, '');
  if (!/\d/.test(d)) return null;
  const n = Math.round(Number(d));
  return Number.isFinite(n) ? n : null;
}

export const factOf = (mission, key) => (mission.facts ?? []).find((f) => f.key === key) ?? null;

// "{d_from}" -> the mission's fact, formatted. Unknown keys stay as written (never a made-up number).
export function fillFacts(text, mission) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (all, k) => {
    const f = factOf(mission, k);
    return f ? formatFact(f) : all;
  });
}

export const money = usd;

// Keeps answers for known steps only, plain values only (strings, numbers, booleans, short string arrays), bounded.
export function sanitizeAnswers(data, raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  const known = new Set(data.missions.flatMap((m) => m.steps.map((s) => s.id)));
  const clean = (v, depth) => {
    if (typeof v === 'string') return v.slice(0, 500);
    if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
    if (typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 100));
    if (v && typeof v === 'object' && depth < 4) {
      const o = {};
      for (const [k, x] of Object.entries(v).slice(0, 40)) {
        const c = clean(x, depth + 1);
        if (c !== undefined) o[k.slice(0, 40)] = c;
      }
      return o;
    }
    return undefined;
  };
  for (const [id, v] of Object.entries(raw)) {
    if (!known.has(id) || !v || typeof v !== 'object' || Array.isArray(v)) continue;
    out[id] = clean(v, 0);
  }
  return out;
}
