// End-to-end conversation test against the running server (npm start), with synthetic voices (macOS `say`).
// It talks to /voice like the page does: sends audio through the same speech gate and answers each time Sherpy
// finishes a turn, choosing a scripted reply from what Sherpy just said. Includes a disagreement on the goal.
// Usage (from agent/, server running): node scripts/e2e-conversation.mjs [caseId]
// Costs one voice session (a few cents). Writes nothing outside data/ (the server writes transcript and profile).
import { WebSocket } from "ws";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSpeechGate } from "../public/speech-gate.mjs";

const caseId = process.argv[2] || "daniel-emily-johnson";
const VOICES = { Daniel: "Daniel", Emily: "Samantha" };
const dir = mkdtempSync(join(tmpdir(), "sherpy-e2e-"));
const t0 = Date.now();
const ts = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`;

function speechPcm(voice, text) {
  const aiff = join(dir, "u.aiff"), wav = join(dir, "u.wav");
  execFileSync("say", ["-v", voice, "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@24000", "-c", "1", aiff, wav]);
  const buf = readFileSync(wav);
  return buf.subarray(buf.indexOf("data") + 8);
}

// Scripted family: picks a reply from Sherpy's last words. Goal: Daniel and Emily disagree first, then agree.
const state = { goalTurns: 0, riskAsked: new Set(), styleAsked: new Set() };
function reply(said) {
  const s = said.toLowerCase();
  const named = s.includes("emily") && !s.includes("daniel") ? "Emily" : s.includes("daniel") && !s.includes("emily") ? "Daniel" : null;
  if (/joining|who('s| is) (here|with)/.test(s)) return ["Daniel", "Hi Sherpy. It's both of us, Daniel and Emily."];
  if (/goal|most important|matters most|priority/.test(s) && !/worr/.test(s)) {
    state.goalTurns++;
    if (state.goalTurns === 1) return ["Daniel", "For me, it's paying for college for the kids."];
    if (state.goalTurns === 2) return ["Emily", "Honestly, I think retirement matters more. We're not saving anything for it."];
    return ["Emily", "Okay, I hear you, Daniel. Let's put college first."];
  }
  if (/worr|keep(s)? you up|concern|stress/.test(s)) return ["Daniel", "Protecting the family if something happens to one of us."];
  if (/20%|twenty percent|drop|sell|buy more/.test(s)) {
    const who = named ?? (state.riskAsked.has("Daniel") ? "Emily" : "Daniel");
    state.riskAsked.add(who);
    return who === "Daniel" ? ["Daniel", "I would buy more. It's a discount."] : ["Emily", "I would sell. I couldn't sleep watching it fall."];
  }
  if (/detail|big picture/.test(s)) return ["Emily", "Just the big picture, please."];
  if (/comfortable|at stake|together|middle ground|both of you feel/.test(s) && state.riskAsked.size === 2) return ["Emily", "I guess we could keep investing, but more carefully. That would feel okay to me."];
  if (/as a couple|approach this|both feel|work for both|balance/.test(s)) return ["Emily", "Okay, I hear you, Daniel. Let's put college first, and look at retirement right after."];
  if (/numbers|what it means for (your|the) family/.test(s)) {
    const who = named ?? (state.styleAsked.has("Daniel") ? "Emily" : "Daniel");
    state.styleAsked.add(who);
    return who === "Daniel" ? ["Daniel", "Show me the numbers."] : ["Emily", "What it means for our family."];
  }
  if (/right\?|correct\?|is that|does that sound|agree/.test(s)) return ["Daniel", "Yes, that's right."];
  return ["Daniel", "Yes."];
}

const ws = new WebSocket(`ws://localhost:5173/voice?case=${caseId}`, { headers: { Origin: "http://localhost:5173" } });
const gate = createSpeechGate();
let said = "", turns = 0, busy = false, finished = false;
const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const silence = setInterval(() => { if (!busy) send({ type: "input_audio_buffer.append", audio: Buffer.from(gate.push(new Int16Array(480)).buffer).toString("base64") }); }, 20);

async function speak(who, text) {
  busy = true;
  console.log(`${ts()}  ${who.toUpperCase()}: ${text}`);
  const pcm = Buffer.concat([speechPcm(VOICES[who], text), Buffer.alloc(48000)]);
  for (let off = 0; off + 960 <= pcm.length; off += 960) {
    const f = new Int16Array(pcm.buffer.slice(pcm.byteOffset + off, pcm.byteOffset + off + 960));
    send({ type: "input_audio_buffer.append", audio: Buffer.from(gate.push(f).buffer).toString("base64") });
    await new Promise((r) => setTimeout(r, 20));
  }
  busy = false;
}

function end(why) {
  if (finished) return;
  finished = true;
  clearInterval(silence);
  console.log(`${ts()}  END: ${why} (${turns} Sherpy turns)`);
  ws.close();
  setTimeout(() => process.exit(0), 500);
}
setTimeout(() => end("timeout 6 min"), 6 * 60 * 1000).unref();

ws.on("open", () => send({ type: "session.update", session: { type: "realtime", audio: {
  input: { format: { type: "audio/pcm", rate: 24000 }, turn_detection: { type: "server_vad", silence_duration_ms: 600 } },
  output: { format: { type: "audio/pcm", rate: 24000 } } } } }));
ws.on("close", () => end("socket closed"));
let audioSec = 0, answerTimer = null;
ws.on("message", async (d) => {
  const ev = JSON.parse(d.toString());
  if (ev.type?.endsWith("audio.delta") && ev.delta) audioSec += (ev.delta.length * 3) / 4 / 48000;
  if (ev.type === "error") console.log(`${ts()}  ERROR ${JSON.stringify(ev.error)}`);
  if (ev.type === "sherpy.conversation_done") { console.log(`${ts()}  >>> sherpy.conversation_done`); setTimeout(() => end("conversation done"), 3000); }
  if (ev.type?.endsWith("audio_transcript.delta")) said += ev.delta ?? "";
  if (ev.type === "response.created") clearTimeout(answerTimer); // Sherpy keeps talking: don't answer yet
  if (ev.type === "response.done" && said.trim()) {
    turns++;
    const text = said.trim(); said = "";
    console.log(`${ts()}  SHERPY: ${text}`);
    if (turns > 30) return end("too many turns");
    // Answer once Sherpy's audio would have finished playing, and only if no new reply starts meanwhile.
    const wait = Math.max(1500, audioSec * 1000 + 800);
    audioSec = 0;
    clearTimeout(answerTimer);
    answerTimer = setTimeout(async () => {
      if (finished || busy) return;
      const [who, line] = reply(text);
      await speak(who, line);
    }, wait);
  }
});
