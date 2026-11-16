import { personaSections } from './persona.mjs';

const WORRY_RULES = [
  ['retirement', /retire/i],
  ['protection', /insurance|umbrella|cover/i],
  ['college', /college|education/i],
  ['debt', /debt|card|loan/i],
  ['home', /home purchase/i],
  ['cash', /reserve|thin cash|idle cash/i],
];

// Title = text after "O<n>...:" up to "(", "." or "**".
// Formats: "**O1: Retirement (SIGNIFICANT).**" and "**O1 SIGNIFICANT: Retirement shortfall.**"
function concernTitle(line) {
  const m = line.match(/\*\*O\d+[^:*]*:\s*([^(.*]*)/);
  return m ? m[1].trim() : null;
}

function worryCategory(title) {
  return WORRY_RULES.find(([, re]) => re.test(title))?.[0] ?? null;
}

export function buildOptions(fh, personaMd) {
  const present = fh.case.household
    .filter((p) => p.role === 'client' || p.role === 'co-client')
    .map((p) => p.first_name);

  const seen = new Set();
  const main_goal = [];
  for (const g of fh.goals.goalsSummary) {
    const value = String(g.goalType).toLowerCase();
    if (seen.has(value)) continue;
    seen.add(value);
    main_goal.push({ value, label: g.value });
  }

  const section = personaSections(personaMd).find((s) => /^Objective concerns/.test(s.heading));
  const top_worry = [];
  for (const line of (section?.text ?? '').split('\n')) {
    const title = concernTitle(line);
    const cat = title && worryCategory(title);
    if (cat && !top_worry.includes(cat)) top_worry.push(cat);
  }
  top_worry.push('none');

  return {
    present,
    main_goal,
    top_worry,
    risk: ['conservative', 'moderate', 'growth'],
    style: ['analytical', 'emotional'],
    detail_level: ['low', 'medium', 'high'],
  };
}
