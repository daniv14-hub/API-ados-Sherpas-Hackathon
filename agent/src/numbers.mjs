// Number extraction and the "is it in the case?" set, used by the grounding check.
// Digits only: numbers written as words are out of scope.

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+`;
const RE = new RegExp(String.raw`(\$)?\s?(${NUM})(?:\s?(million|billion|thousand|percent|%)|([kKmMbB])(?![A-Za-z]))?`, 'g');
const YEAR_CONTEXT = new RegExp(String.raw`(?:\b(?:${MONTHS})\.?\s*|\b(?:in|by)\s*)$`, 'i');
const MULT = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

export const norm = (v) => Number(v.toPrecision(12));

// Returns [{ value, percent, raw }]; percent is true when written as 24.9% / 24.9 percent.
export function extractMentions(text) {
  const out = [];
  for (const m of String(text).matchAll(RE)) {
    const [raw, , digits, word, letter] = m;
    let value = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    const suffix = (word || letter || '').toLowerCase();
    const percent = suffix === '%' || suffix === 'percent';
    if (!suffix && /^(19|20)\d{2}$/.test(digits) && value >= 1900 && value <= 2100
      && YEAR_CONTEXT.test(String(text).slice(0, m.index))) continue;
    if (MULT[suffix]) value *= MULT[suffix];
    out.push({ value: norm(value), percent, raw: raw.trim() });
  }
  return out;
}

export const extractNumbers = (text) => extractMentions(text).map((m) => m.value);

function collect(node, add) {
  if (typeof node === 'number') add(node);
  else if (typeof node === 'string') extractNumbers(node).forEach(add);
  else if (Array.isArray(node)) node.forEach((n) => collect(n, add));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => collect(n, add));
}

// Every number in the sources, plus K/M rounded forms (1,632,000 also matches "$1.6 million",
// 251,400 also matches "251K"). Rounding is only to 1 decimal in millions / whole thousands.
export function caseNumbers(fh, ia, personaMd) {
  const set = new Set();
  const add = (v) => {
    const a = Math.abs(v);
    set.add(norm(a));
    if (a >= 1e6) set.add(norm(Math.round(a / 1e5) / 10 * 1e6));
    if (a >= 1e3) set.add(norm(Math.round(a / 1e3) * 1e3));
  };
  collect(fh, add);
  collect(ia, add);
  collect(personaMd, add);
  return set;
}

// A percent p matches a data value p or p/100 (rates stored as 0.249).
export function isGrounded(mention, set) {
  if (set.has(mention.value)) return true;
  return mention.percent && set.has(norm(mention.value / 100));
}
