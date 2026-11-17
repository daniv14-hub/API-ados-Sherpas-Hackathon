// Product conversation screen (option A). Views: start -> call -> (pause | error | making the video).
// Voice logic lives in voice-client.mjs (same behaviour as the bench), pure rules in conversation-logic.mjs.
// Hook for the next step: window event "sherpy:done" with detail {caseId} fires once Sherpy has said goodbye and
// the voice session is closed. This file does not navigate anywhere by itself.
import { createVoiceClient } from "/voice-client.mjs";
import { tokenize, isKeyWord, wordTimes, revealedCount, currentSentence, turnPhase, PHASE_LABEL, classifyError } from "/conversation-logic.mjs";

const $ = (id) => document.getElementById(id);
const DEFAULT_CASE = "daniel-emily-johnson";
const params = new URLSearchParams(location.search);
let caseId = params.get("case") || DEFAULT_CASE;
let cfg = null, client = null, making = false, raf = 0;

document.querySelectorAll("[data-sherpy]").forEach((el) => (el.innerHTML = $("sherpy-svg").innerHTML));
document.querySelectorAll("[data-mic]").forEach((el) => (el.innerHTML = $("mic").innerHTML));

// ---------- views ----------
const VIEWS = ["start", "call", "pause", "error"];
function show(name) {
  for (const v of VIEWS) $(v).hidden = v !== name;
  $("end").hidden = name !== "call" || making;
  if (name !== "call") { cancelAnimationFrame(raf); raf = 0; }
}
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

function frame() {
  raf = requestAnimationFrame(frame);
  if (!client) return;
  const s = client.snapshot();
  const phase = turnPhase({ connected: s.connected && !!s.reply, speaking: s.speaking, muted: s.muted, thinking: s.thinking, done: false });
  const call = $("call");
  call.classList.toggle("talking", phase === "sherpy");
  call.classList.toggle("listening", phase === "user");
  $("turn-label").textContent = PHASE_LABEL[phase];

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

async function startCall() {
  if (client) client.stop();
  making = false;
  $("callstage").classList.remove("making", "busy");
  resetWords(); delete $("sentence-live").dataset.s;
  $("turn-label").textContent = PHASE_LABEL.connecting;
  show("call");
  raf = requestAnimationFrame(frame);
  const c = createVoiceClient({
    caseId, model: cfg?.model ?? "",
    handlers: {
      onError: (e) => { if (c === client) showError(classifyError(e)); },
      onClosed: (e) => { if (c === client) showError(classifyError({ source: "close", code: e.code })); },
      onDone: () => { if (c === client) conversationDone(); },
    },
  });
  client = c;
  await c.start();
}

// Sherpy said goodbye and the voice session is closed: hand over to the next step (wired elsewhere).
function conversationDone() {
  making = true;
  $("callstage").classList.add("making", "busy");
  $("callstage").classList.remove("talking", "listening");
  $("end").hidden = true;
  cancelAnimationFrame(raf); raf = 0;
  window.dispatchEvent(new CustomEvent("sherpy:done", { detail: { caseId } }));
}

function endCall() {
  client?.stop(); client = null;
  show("pause");
}

// ---------- wiring ----------
$("end").onclick = () => $("confirm").showModal();
$("keep").onclick = () => $("confirm").close();
$("end-now").onclick = () => { $("confirm").close(); endCall(); };
$("resume").onclick = () => startCall();
$("go").onclick = () => startCall();
$("family").onchange = (e) => setCase(e.target.value);
addEventListener("pagehide", () => client?.stop()); // voice is billed per session: never leave one open

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
