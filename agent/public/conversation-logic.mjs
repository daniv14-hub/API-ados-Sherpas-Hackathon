// Pure logic of the conversation screen (runs in the page; node tests import it too).
// Only Sherpy's words are shown. This file decides which words are highlighted, when each word
// appears while the audio plays, whose turn it is, and how a failure is described to the family.

// ---------- words and sentences ----------
const NOT_END = new Set(["mr.", "mrs.", "ms.", "dr.", "vs.", "e.g.", "i.e.", "st."]);

// "Hello Daniel! I'm Sherpy." -> [{text, sentence, weight}] (sentence = index, weight = how long it takes to say)
export function tokenize(text) {
  const out = [];
  let sentence = 0;
  for (const raw of String(text ?? "").split(/\s+/)) {
    if (!raw) continue;
    const letters = raw.replace(/[^\p{L}\p{N}]/g, "").length;
    const ends = /[.!?…]["')\]”’]*$/.test(raw) && !NOT_END.has(raw.toLowerCase());
    const pause = ends ? 6 : /[,;:—–]$/.test(raw) ? 3 : 0;
    out.push({ text: raw, sentence, weight: Math.max(2, letters) + 1 + pause });
    if (ends) sentence++;
  }
  return out;
}

// ---------- key words (rendered in brand blue) ----------
const NUMBER_WORDS = new Set(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty",
  "seventy", "eighty", "ninety", "hundred", "thousand", "million", "billion", "percent", "dollar", "dollars", "cents"]);
const FINANCE_WORDS = new Set(["retirement", "retire", "401k", "ira", "roth", "savings", "saving", "invest", "invested", "investing",
  "investment", "investments", "mortgage", "debt", "debts", "insurance", "budget", "emergency", "fund", "funds", "goal", "goals", "risk",
  "income", "tax", "taxes", "portfolio", "college", "stocks", "bonds", "inflation", "loan", "loans", "cash", "pension", "estate"]);

// Rule: any token with a digit (amounts, percentages, years, 401k), a spelled-out number or money word,
// or a word from the short finance list above. Punctuation around the word is ignored.
export function isKeyWord(token) {
  const w = String(token).toLowerCase().replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}%]+$/gu, "").replace(/['’]s$/, "");
  if (!w) return false;
  if (/[0-9$%]/.test(w)) return true;
  return NUMBER_WORDS.has(w) || FINANCE_WORDS.has(w) || w.split("-").some((p) => NUMBER_WORDS.has(p) && p.length > 3);
}

// ---------- word timing ----------
export const DEFAULT_RATE = 15; // weight units per second of speech (about 150 words per minute)

// Seconds from the start of the reply at which each word appears. While the audio is still
// streaming we don't know its length, so we assume DEFAULT_RATE; once it ends (duration known)
// the schedule is stretched so the last word lands where the audio really ends.
export function wordTimes(tokens, { duration = null, rate = DEFAULT_RATE } = {}) {
  const total = tokens.reduce((s, t) => s + t.weight, 0);
  const scale = duration && duration > 0 && total > 0 ? duration / total : 1 / rate;
  let acc = 0;
  return tokens.map((t) => { const at = acc * scale; acc += t.weight; return at; });
}

// How many words are visible `elapsed` seconds after the reply started. Never goes down:
// pass the previous count as `floor` so a re-scaled schedule can't hide a word already shown.
export function revealedCount(times, elapsed, floor = 0) {
  let n = 0;
  while (n < times.length && times[n] <= elapsed) n++;
  return Math.max(n, Math.min(floor, times.length));
}

// Index of the sentence to show: the one holding the latest visible word.
export function currentSentence(tokens, shown) {
  return shown > 0 ? tokens[Math.min(shown, tokens.length) - 1].sentence : 0;
}

// ---------- whose turn ----------
// connecting: waiting for Sherpy's first words. sherpy: audio playing (or its echo tail, mic muted).
// thinking: the family stopped talking, Sherpy hasn't started. user: mic open. done / ended: finished.
export function turnPhase({ connected, speaking, muted, thinking, done }) {
  if (done) return "done";
  if (!connected) return "connecting";
  if (speaking || muted) return "sherpy";
  if (thinking) return "thinking";
  return "user";
}

export const PHASE_LABEL = {
  connecting: "Sherpy is joining…",
  sherpy: "Sherpy is speaking",
  thinking: "Sherpy is thinking…",
  user: "Your turn · speak now",
  done: "All done",
};

// ---------- errors ----------
// source: "mic" (getUserMedia failed, name = DOMException name), "event" (error event from the server),
// "close" (the socket closed without us asking, code = close code), "config" (unknown case / /config failed).
export function classifyError({ source, name, code, message } = {}) {
  if (source === "mic") {
    return name === "NotFoundError" || name === "OverconstrainedError"
      ? { kind: "no-mic", title: "We can't find a microphone", text: "Plug in or enable a microphone, then try again.", retry: "Try again" }
      : { kind: "mic-denied", title: "Sherpy can't hear you yet", text: "Allow microphone access in your browser's address bar, then try again.", retry: "Try again" };
  }
  if (source === "config" || code === 1008) {
    return { kind: "unknown-case", title: "We can't find that plan", text: "This link doesn't match a family plan. Pick a family below or check the link.", retry: null };
  }
  if (source === "event" && message === "plan_unavailable") {
    return { kind: "plan", title: "Your plan isn't available right now", text: "Sherpy couldn't open your plan. Please try again in a moment.", retry: "Try again" };
  }
  if (source === "event" && /^proxy HTTP/.test(message ?? "")) {
    return { kind: "refused", title: "Sherpy couldn't connect", text: "The voice service said no. Please try again in a moment.", retry: "Try again" };
  }
  return { kind: "lost", title: "The connection dropped", text: "Sherpy keeps what you've shared so far. Reconnect to pick up where you left off.", retry: "Reconnect" };
}
