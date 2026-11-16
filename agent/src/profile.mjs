import fs from 'node:fs/promises';
import path from 'node:path';

const QUESTIONS = ['present', 'main_goal', 'top_worry', 'risk', 'style', 'detail_level'];

export function isSafeCaseId(id) {
  return typeof id === 'string' && /^[a-z]+(-[a-z]+)*$/.test(id);
}

export function newProfile(caseId, adults) {
  return {
    caseId,
    present: [],
    people: Object.fromEntries(adults.map((n) => [n, {}])),
    main_goal: { agreed: null, byPerson: {} },
    top_worry: { agreed: null, byPerson: {} },
    detail_level: null,
    phase1Complete: false,
    updatedAt: new Date().toISOString(),
  };
}

export function isPhase1Complete(p) {
  if (!p.present?.length) return false;
  if (!p.main_goal?.agreed || !p.top_worry?.agreed || !p.detail_level) return false;
  return p.present.every((n) => p.people?.[n]?.risk && p.people?.[n]?.style);
}

function allowed(question, options) {
  const list = options[question] ?? [];
  return list.map((o) => (typeof o === 'object' ? o.value : o));
}

const fail = (error) => ({ ok: false, error });

export function applyAnswer(profile, { question, person, value }, options) {
  if (!QUESTIONS.includes(question)) return fail(`unknown question: ${question}`);
  const next = structuredClone(profile);

  if (question === 'present') {
    const names = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    const bad = names.filter((n) => !options.present.includes(n));
    if (!names.length || bad.length) return fail(`invalid names: ${bad.join(', ') || '(none)'}; allowed: ${options.present.join(', ')}`);
    next.present = [...new Set(names)];
  } else {
    const ok = allowed(question, options);
    if (!ok.includes(value)) return fail(`invalid value for ${question}; allowed: ${ok.join(', ')}`);
    if (question === 'risk' || question === 'style') {
      if (!options.present.includes(person)) return fail(`unknown person: ${person}; allowed: ${options.present.join(', ')}`);
      next.people[person] = { ...next.people[person], [question]: value };
    } else if (question === 'detail_level') {
      if (person !== 'household') return fail('detail_level person must be "household"');
      next.detail_level = value;
    } else {
      if (person === 'household') next[question].agreed = value;
      else if (options.present.includes(person)) next[question].byPerson[person] = value;
      else return fail(`unknown person: ${person}; allowed: ${options.present.join(', ')}, household`);
    }
  }
  next.phase1Complete = isPhase1Complete(next);
  next.updatedAt = new Date().toISOString();
  return { ok: true, profile: next };
}

function fileFor(dir, caseId) {
  if (!isSafeCaseId(caseId)) throw new Error(`unsafe caseId: ${caseId}`);
  return path.join(dir, `${caseId}.json`);
}

export async function loadProfile(dir, caseId, adults) {
  const file = fileFor(dir, caseId);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return newProfile(caseId, adults);
  }
}

export async function saveProfile(dir, profile) {
  const file = fileFor(dir, profile.caseId);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(profile, null, 2));
  await fs.rename(tmp, file);
}
