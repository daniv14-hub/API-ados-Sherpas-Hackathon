// Product conversation screen (option A). Views: start -> call -> (pause | error | making the video).
// Voice logic lives in voice-client.mjs (same behaviour as the bench), pure rules in conversation-logic.mjs.
// Hook for the next step: window event "sherpy:done" with detail {caseId} fires once Sherpy has said goodbye and
// the voice session is closed. This file does not navigate anywhere by itself.
import { createVoiceClient } from "/voice-client.mjs";
import { demoFamilyOn, loadManifest, createFamilyVoice, createAutopilot } from "/demo-family.mjs";
import { tokenize, isKeyWord, wordTimes, revealedCount, currentSentence, turnPhase, PHASE_LABEL, classifyError } from "/conversation-logic.mjs";

const $ = (id) => document.getElementById(id);
const DEFAULT_CASE = "daniel-emily-johnson";
const params = new URLSearchParams(location.search);
let caseId = params.get("case") || DEFAULT_CASE;
let cfg = null, client = null, making = false, raf = 0;
// Demo mode (?family=demo): Daniel and Emily are recorded voices that answer Sherpy on their own (demo-family.mjs).
const DEMO = demoFamilyOn();
const demoLines = DEMO ? loadManifest().catch((e) => { console.error(e.message); return null; }) : null;
let autopilot = null;

document.querySelectorAll("[data-sherpy]").forEach((el) => (el.innerHTML = $("sherpy-svg").innerHTML));
document.querySelectorAll("[data-mic]").forEach((el) => (el.innerHTML = $("mic").innerHTML));

// ---------- views ----------
const VIEWS = ["start", "call", "pause", "error"];
const HEADING = { start: "start-title", call: "call-title", pause: "pause-title", error: "err-title" };
let current = null;
// Shows one view (start / call / pause / error) and moves keyboard focus to its heading.
function show(name) {
  for (const v of VIEWS) $(v).hidden = v !== name;
  // The button that was pressed has just disappeared: put focus on the new view's heading (not on first load).
  if (current && current !== name) $(HEADING[name]).focus({ preventScroll: true });
  current = name;
  $("end").hidden = name !== "call" || making;
  if (name !== "call") { cancelAnimationFrame(raf); raf = 0; }
}
// Error view: title, text and a retry button; for an unknown case it lists the demo families.
function showError(info) {
  $("err-title").textContent = info.title;
  $("err-text").textContent = info.text;
  $("retry").hidden = !info.retry;
  $("retry").textContent = info.retry ?? "";
  $("retry").onclick = info.onRetry ?? (() => startCall());
  const list = $("fam-list");
  list.hidden = info.kind !== "unknown-case" || !cfg?.cases?.length;
  list.replaceChildren();
  if (!list.hidden) for (const c of cfg.cases) {
    const b = document.createElement("button");
    b.className = "btn ghost"; b.type = "button"; b.textContent = c.label;
    b.onclick = () => { setCase(c.id); show("start"); };
    list.append(b);
  }
  show("error");
}

// ---------- case selection (demo only: a small selector, the case normally comes from ?case=) ----------
function setCase(id) {
  caseId = id;
  const u = new URL(location.href); u.searchParams.set("case", id);
  history.replaceState(null, "", u);
  $("family").value = id;
}

// ---------- call ----------
let words = { rid: 0, textLen: -1, tokens: [], shownFloor: 0, sentence: -1, spans: 0, spanEls: [] };
// Live captions: Sherpy's words appear one by one, timed to its audio, one sentence at a time.
function resetWords() {
  words = { rid: 0, textLen: -1, tokens: [], shownFloor: 0, sentence: -1, spans: 0, spanEls: [] };
  $("caption").replaceChildren(); $("sentence-live").textContent = "";
}

function renderSentence(idx) {
  const cap = $("caption");
  if (words.sentence !== idx) { cap.replaceChildren(); words.spanEls = []; words.spans = 0; words.sentence = idx; cap.scrollTop = 0; }
  const { tokens } = words;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].sentence !== idx || words.spanEls[i]) continue;
    const s = document.createElement("span");
    s.className = "w" + (isKeyWord(tokens[i].text) ? " key" : "");
    s.textContent = tokens[i].text;
    cap.append(s);
    words.spanEls[i] = s;
  }
}

// Runs every animation frame during the call: reads the voice client state, updates the turn pill
// ('Sherpy is speaking' / 'Your turn') and reveals the caption words in step with the audio.
function frame() {
  raf = requestAnimationFrame(frame);
  if (!client) return;
  const s = client.snapshot();
  const phase = turnPhase({ connected: s.connected && !!s.reply, speaking: s.speaking, muted: s.muted, thinking: s.thinking, done: false });
  const call = $("call");
  call.classList.toggle("talking", phase === "sherpy");
  call.classList.toggle("listening", phase === "user");
  const label = $("turn-label"); // a live region: write it only when it changes, or screen readers repeat it every frame
  if (label.textContent !== PHASE_LABEL[phase]) label.textContent = PHASE_LABEL[phase];

  const r = s.reply;
  if (!r) return;
  // Hold back a half-received last word until the next delta (or the end of the reply) completes it.
  const complete = r.audioDone || /\s$/.test(r.text) ? r.text : r.text.replace(/\S+$/, "");
  if (r.id !== words.rid) {
    if (!tokenize(complete).length) return; // keep the previous sentence on screen until the new reply has words
    words.rid = r.id; words.textLen = -1; words.shownFloor = 0; words.sentence = -1; words.spanEls = []; words.tokens = [];
  }
  if (complete.length !== words.textLen) { words.textLen = complete.length; words.tokens = tokenize(complete); }
  const { tokens } = words;
  if (!tokens.length) return;
  const times = wordTimes(tokens, { duration: r.audioDone ? r.seconds : null });
  const elapsed = r.startAt ? s.now - r.startAt : -1;
  const shown = revealedCount(times, elapsed, words.shownFloor);
  words.shownFloor = shown;
  const idx = currentSentence(tokens, shown);
  renderSentence(idx);
  words.spanEls.forEach((el, i) => el.classList.toggle("on", i < shown));
  const live = tokens.filter((t) => t.sentence === idx).map((t) => t.text).join(" ");
  if (shown && $("sentence-live").dataset.s !== `${r.id}:${idx}`) { $("sentence-live").dataset.s = `${r.id}:${idx}`; $("sentence-live").textContent = live; }
}

// Starts the voice call: creates the voice client (real mic, or the recorded demo family when
// ?family=demo), wires its callbacks, and in demo mode starts the autopilot that answers Sherpy.
async function startCall() {
  if (client) client.stop();
  making = false;
  $("callstage").classList.remove("making", "busy");
  resetWords(); delete $("sentence-live").dataset.s;
  $("turn-label").textContent = PHASE_LABEL.connecting;
  show("call");
  raf = requestAnimationFrame(frame);
  autopilot?.stop(); autopilot = null;
  let family = null;
  const lines = DEMO ? await demoLines : null;
  if (lines) family = createFamilyVoice({ lines, onLine: showFamilyLine });
  const c = createVoiceClient({
    caseId, model: cfg?.model ?? "", family,
    handlers: {
      onReplyDone: (text) => { if (c === client) autopilot?.heard(text); },
      onError: (e) => { if (c === client) showError(classifyError(e)); },
      onClosed: (e) => { if (c === client) showError(classifyError({ source: "close", code: e.code })); },
      onDone: () => { if (c === client) { autopilot?.stop(); conversationDone(); } },
    },
  });
  client = c;
  if (family) autopilot = createAutopilot({ voice: family, client: c, log: (m) => console.log(`[demo family] ${m}`) });
  await c.start();
}

// Sherpy said goodbye and the voice session is closed: hand over to the next step (wired elsewhere).
function conversationDone() {
  making = true;
  $("callstage").classList.add("making", "busy");
  $("call").classList.remove("talking", "listening");
  $("end").hidden = true;
  if ($("confirm").open) $("confirm").close(); // they pressed End just as Sherpy said goodbye: the conversation is complete
  cancelAnimationFrame(raf); raf = 0;
  window.dispatchEvent(new CustomEvent("sherpy:done", { detail: { caseId } }));
}

// Demo mode: who is speaking and what, under Sherpy's caption.
function showFamilyLine(line) {
  const el = $("family-line");
  if (!el) return;
  el.replaceChildren();
  if (!line) { el.hidden = true; return; }
  const b = document.createElement("b"); b.textContent = `${line.who}: `;
  el.append(b, line.text);
  el.hidden = false;
}

// The family pressed End: close the paid voice session and show the pause view.
function endCall() {
  autopilot?.stop(); autopilot = null;
  client?.stop(); client = null;
  show("pause");
}

// ---------- wiring ----------
$("end").onclick = () => $("confirm").showModal();
$("keep").onclick = () => $("confirm").close();
$("end-now").onclick = () => {
  $("confirm").close();
  // Sherpy already said goodbye and the client hangs up on its own in a moment: let the hand-off to the video run
  // instead of pausing a finished conversation.
  if (client?.snapshot().finished) return;
  endCall();
};
$("resume").onclick = () => startCall();
$("go").onclick = () => startCall();
$("family").onchange = (e) => setCase(e.target.value);
addEventListener("pagehide", () => client?.stop()); // voice is billed per session: never leave one open

// Page start: loads /config (the list of cases) and fills the demo family selector.
async function init() {
  try {
    cfg = await (await fetch("/config")).json();
    if (!Array.isArray(cfg.cases)) throw new Error("bad config");
  } catch {
    showError({ kind: "config-failed", title: "We couldn't reach Sherpy", text: "Check your connection and try again.", retry: "Try again", onRetry: () => location.reload() });
    return;
  }
  const sel = $("family");
  for (const c of cfg.cases) sel.add(new Option(c.label, c.id));
  if (!cfg.cases.some((c) => c.id === caseId)) { showError(classifyError({ source: "config" })); return; }
  sel.value = caseId;
  $("go").disabled = false;
  show("start");
}
show("start");
init();
