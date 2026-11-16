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
    const spoken = value;
    const scale = MULT[suffix] ?? 1;
    value *= scale;
    const decimals = (digits.split('.')[1] ?? '').length;
    out.push({ value: norm(value), percent, raw: raw.trim(), index: m.index + raw.indexOf(digits), spoken, scale, decimals });
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

// Every number in the sources, as raw absolute values. No rounded forms are precomputed:
// rounding slack is applied per mention in isGrounded.
export function caseNumbers(fh, ia, personaMd) {
  const set = new Set();
  const add = (v) => set.add(norm(Math.abs(v)));
  collect(fh, add);
  collect(ia, add);
  collect(personaMd, add);
  return set;
}

// A mention is grounded if some case value v, rounded to the precision the mention was spoken in
// (in units of its K/M scale), equals the spoken number. Unsuffixed "$34,000" therefore needs
// an exact (integer-rounded) value; "1.6 million" needs round(v/1e5)/10 === 1.6; "250K" needs
// round(v/1e3) === 250. A percent p also matches a rate v < 1 with v*100 at the same precision.
export function isGrounded(m, set) {
  const f = 10 ** m.decimals;
  const hit = (v) => norm(Math.round((v / m.scale) * f) / f) === norm(m.spoken);
  for (const v of set) {
    if (hit(v)) return true;
    if (m.percent && v < 1 && hit(v * 100)) return true;
  }
  return false;
}
