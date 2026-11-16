// Throwaway debugging probe for the first live test (16/11). Opens short gemini-3.8-live sessions on the proxy.
// Usage (from agent/): node --env-file=../.env scripts/probe-voice.mjs <mode> [arg]
//   silence            stream 12 s of digital silence, then 12 s of faint noise; log VAD / transcription / responses
//   voice <name>       ask for one fixed sentence with audio.output.voice=<name>; save a WAV to data/voice-samples/
//   lang               English-only instructions, user says "¿Qué?" as text; print the reply
//   audio <wav> [instr] stream 1 s silence + a 24 kHz mono WAV + 3 s silence through server VAD; print reply
import { WebSocket } from "ws";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [mode, arg] = process.argv.slice(2);
const MODEL = "gemini-3.8-live";
const base = (process.env.LLM_PROXY_URL || "https://llm-hackathon.sherpaswealth.com").replace(/\/$/, "").replace(/^http/, "ws");
if (!process.env.TEAM_KEY) throw new Error("TEAM_KEY missing");
const t0 = Date.now();
const ms = () => `${String(Date.now() - t0).padStart(6)}ms`;
const ws = new WebSocket(`${base}/v1/realtime?model=${MODEL}`, { headers: { Authorization: `Bearer ${process.env.TEAM_KEY}` } });
const send = (o) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(o));
const audio = [];
let text = "";
let finished = false;
function done(why) {
  if (finished) return;
  finished = true;
  console.log(`[${ms()}] done: ${why}`);
  if (mode === "voice" && audio.length) {
    const pcm = Buffer.concat(audio);
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24);
    h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
    mkdirSync("../data/voice-samples", { recursive: true });
    const f = `../data/voice-samples/${arg}.wav`;
    writeFileSync(f, Buffer.concat([h, pcm]));
    console.log(`saved ${f} (${(pcm.length / 48000).toFixed(1)} s)`);
  }
  console.log(`text: ${JSON.stringify(text)}`);
  ws.close();
  setTimeout(() => process.exit(0), 300);
}
setTimeout(() => done("timeout"), mode === "silence" ? 32000 : process.env.PROBE_KICK ? 32000 : 20000).unref();

const audioCfg = { input: { format: { type: "audio/pcm", rate: 24000 }, turn_detection: process.env.PROBE_TD ? JSON.parse(process.env.PROBE_TD) : { type: "server_vad", silence_duration_ms: 600 } },
  output: { format: { type: "audio/pcm", rate: 24000 }, ...(mode === "voice" ? { voice: arg } : {}) } };

ws.on("unexpected-response", (_q, res) => { console.log(`refused HTTP ${res.statusCode}`); done("refused"); });
ws.on("error", (e) => console.log(`ws error ${e.message}`));
ws.on("close", (c) => done(`closed ${c}`));
ws.on("open", async () => {
  if (mode === "silence") {
    send({ type: "session.update", session: { type: "realtime", instructions: "You are a helpful assistant. Always speak English.", audio: audioCfg } });
    const chunk = 480; // 20 ms at 24 kHz
    let sent = 0;
    const iv = setInterval(() => {
      const buf = Buffer.alloc(chunk * 2);
      if (sent >= 600) for (let i = 0; i < chunk; i++) buf.writeInt16LE(Math.round((Math.random() * 2 - 1) * 60), i * 2); // ~-55 dBFS noise
      send({ type: "input_audio_buffer.append", audio: buf.toString("base64") });
      if (++sent === 600) console.log(`[${ms()}] --- switching from silence to faint noise ---`);
      if (sent >= 1200) { clearInterval(iv); setTimeout(() => done("streamed 24 s"), 3000); }
    }, 20);
  } else if (mode === "voice") {
    send({ type: "session.update", session: { type: "realtime", instructions: "Repeat exactly what the user writes, in a warm, friendly advisor voice.", audio: audioCfg } });
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "Hi, I'm Sherpy, your Sherpas advisor. I'd love to understand what matters most to you both." }] } });
    send({ type: "response.create" });
  } else if (mode === "lang") {
    send({ type: "session.update", session: { type: "realtime", instructions: "You are Sherpy, a financial advisor. Always speak English, even if the user speaks another language or the input is unclear.", audio: audioCfg } });
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "¿Qué?" }] } });
    send({ type: "response.create" });
  } else if (mode === "audio") {
    const a4 = process.argv[4]; const instr = a4?.startsWith("@") ? readFileSync(a4.slice(1), "utf8") : a4 || "You are Sherpy, a financial advisor. Always speak English.";
    send({ type: "session.update", session: { type: "realtime", instructions: instr, audio: audioCfg } });
    const wav = readFileSync(arg).subarray(44);
    const pcm = Buffer.concat([Buffer.alloc(48000), wav, Buffer.alloc(144000)]);
    // PROBE_GATE=1 runs the page's speech gate on the audio first, like the real page does.
    const gate = process.env.PROBE_GATE ? (await import("../public/speech-gate.mjs")).createSpeechGate() : null;
    // PROBE_KICK=1: Sherpy greets first (like the server's kickoff), the audio arrives 10 s later.
    if (process.env.PROBE_KICK) {
      send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "(The family has just joined the call. Start the conversation now, in English.)" }] } });
      send({ type: "response.create" });
      await new Promise((r) => setTimeout(r, 10000));
      text += " ||| ";
    }
    let off = 0;
    const iv = setInterval(() => {
      if (off + 960 > pcm.length) { clearInterval(iv); return; }
      let chunk = pcm.subarray(off, off + 960);
      if (gate) { const f = new Int16Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + 960)); chunk = Buffer.from(gate.push(f).buffer); }
      send({ type: "input_audio_buffer.append", audio: chunk.toString("base64") });
      off += 960;
    }, 20);
  } else throw new Error("mode: silence | voice <name> | lang");
});
ws.on("message", (d) => {
  const ev = JSON.parse(d.toString());
  const t = ev.type;
  if (t.endsWith("audio.delta")) { if (mode === "voice") audio.push(Buffer.from(ev.delta, "base64")); return; }
  if (t.endsWith("transcript.delta") || t.endsWith("text.delta")) { text += ev.delta ?? ""; return; }
  if (t === "session.updated") console.log(`[${ms()}] session.updated voice=${JSON.stringify(ev.session?.audio?.output?.voice)} turn_detection=${JSON.stringify(ev.session?.audio?.input?.turn_detection)}`);
  else if (t === "error") console.log(`[${ms()}] ERROR ${JSON.stringify(ev.error ?? ev).slice(0, 300)}`);
  else if (t.includes("input_audio")) console.log(`[${ms()}] ${t} ${ev.transcript ? JSON.stringify(ev.transcript) : ""}`);
  else console.log(`[${ms()}] ${t}`);
  if (t === "response.done" && mode !== "silence" && (mode !== "audio" || (process.env.PROBE_KICK ? text.split("|||")[1]?.trim() : text))) done("response.done");
});
