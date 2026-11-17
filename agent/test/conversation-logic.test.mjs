import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, isKeyWord, wordTimes, revealedCount, currentSentence, turnPhase, classifyError } from "../public/conversation-logic.mjs";

test("tokenize splits sentences and keeps abbreviations together", () => {
  const t = tokenize("Hello Daniel! I'm Sherpy. Ask Dr. Lee? Yes");
  assert.deepEqual(t.map((x) => x.sentence), [0, 0, 1, 1, 2, 2, 2, 3]);
  assert.equal(tokenize("  ").length, 0);
  assert.equal(tokenize(null).length, 0);
});

test("a sentence end weighs more than a plain word (pause)", () => {
  const [a, b] = tokenize("Hello. Hello");
  assert.ok(a.weight > b.weight);
});

test("key words: numbers, money, years, percent, finance list", () => {
  for (const w of ["$1,166,000", "401k", "2031", "20%", "twenty", "percent,", "million", "thirty-five", "Retirement.", "mortgage?"]) assert.ok(isKeyWord(w), w);
  for (const w of ["Hello", "the", "you", "I'm", "Sherpy,", "plan", "…", ""]) assert.ok(!isKeyWord(w), w);
});

test("wordTimes: default rate while streaming, stretched to the real duration once known", () => {
  const t = tokenize("one two three four");
  const open = wordTimes(t);
  assert.equal(open[0], 0);
  assert.ok(open.every((v, i) => i === 0 || v > open[i - 1]));
  const fixed = wordTimes(t, { duration: 4 });
  const total = t.reduce((s, x) => s + x.weight, 0);
  const last = t.at(-1).weight;
  assert.ok(Math.abs(fixed.at(-1) - (4 * (total - last)) / total) < 1e-9);
  assert.ok(fixed.at(-1) < 4);
});

test("revealedCount follows elapsed time and never goes down", () => {
  const times = [0, 0.4, 0.9, 1.5];
  assert.equal(revealedCount(times, -1), 0);
  assert.equal(revealedCount(times, 0), 1);
  assert.equal(revealedCount(times, 1), 3);
  assert.equal(revealedCount(times, 10), 4);
  assert.equal(revealedCount(times, 0.1, 3), 3);
  assert.equal(revealedCount(times, 0.1, 99), 4);
});

test("currentSentence is the sentence of the latest visible word", () => {
  const t = tokenize("Hi there. How are you?");
  assert.equal(currentSentence(t, 0), 0);
  assert.equal(currentSentence(t, 2), 0);
  assert.equal(currentSentence(t, 3), 1);
  assert.equal(currentSentence(t, 99), 1);
});

test("turn state machine", () => {
  const base = { connected: true, speaking: false, muted: false, thinking: false, done: false };
  assert.equal(turnPhase({ ...base, connected: false }), "connecting");
  assert.equal(turnPhase({ ...base, speaking: true }), "sherpy");
  assert.equal(turnPhase({ ...base, muted: true }), "sherpy"); // echo tail: mic still muted
  assert.equal(turnPhase({ ...base, thinking: true }), "thinking");
  assert.equal(turnPhase(base), "user");
  assert.equal(turnPhase({ ...base, speaking: true, done: true }), "done");
  assert.equal(turnPhase({ ...base, speaking: true, thinking: true }), "sherpy");
});

test("classifyError maps failures to a clear message and a retry", () => {
  assert.equal(classifyError({ source: "mic", name: "NotAllowedError" }).kind, "mic-denied");
  assert.equal(classifyError({ source: "mic", name: "NotFoundError" }).kind, "no-mic");
  assert.equal(classifyError({ source: "close", code: 1008 }).kind, "unknown-case");
  assert.equal(classifyError({ source: "config" }).retry, null);
  assert.equal(classifyError({ source: "event", message: "proxy HTTP 502" }).kind, "refused");
  assert.equal(classifyError({ source: "event", message: "plan_unavailable" }).kind, "plan");
  assert.equal(classifyError({ source: "close", code: 1006 }).kind, "lost");
  for (const k of ["mic-denied", "refused", "lost"]) assert.ok(classifyError({ source: k === "mic-denied" ? "mic" : k === "refused" ? "event" : "close", message: "proxy HTTP 1" }).retry);
});
