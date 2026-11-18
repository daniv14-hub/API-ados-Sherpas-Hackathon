// One-off check (ruling R9): does a mid-session session.update change the instructions on the proxy?
// Text only, closes within 20 s. Usage: node --env-file=../.env scripts/check-phase-switch.mjs [model]
import { WebSocket } from "ws";

const model = process.argv[2] || "gemini-3.8-live";
const base = (process.env.LLM_PROXY_URL || "https://llm-hackathon.sherpaswealth.com").replace(/\/$/, "").replace(/^http/, "ws");
const t0 = Date.now();
const ms = () => `${Date.now() - t0}ms`;
const ws = new WebSocket(`${base}/v1/realtime?model=${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${process.env.TEAM_KEY}` } });
const replies = ["", ""];
let responses = 0, finished = false;

function done(why) {
  if (finished) return;
  finished = true;
  console.log(`[${ms()}] finish: ${why}`);
  console.log(`RESULT model=${model} reply1=${JSON.stringify(replies[0])} reply2=${JSON.stringify(replies[1])}`);
  console.log(`SECOND_FOLLOWS_BRAVO=${/BRAVO/i.test(replies[1]) && !/ALPHA/i.test(replies[1])}`);
  try { ws.close(); } catch {}
  setTimeout(() => process.exit(0), 500);
}
setTimeout(() => done("timeout 20s"), 20000).unref?.();
const send = (o) => ws.send(JSON.stringify(o));
const instructions = (word) => ({ type: "session.update", session: {
  type: "realtime", output_modalities: ["text"], instructions: `Answer every message with exactly the word ${word}.`,
} });
const ask = (text) => {
  send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
  send({ type: "response.create" });
};

ws.on("unexpected-response", (_r, res) => {
  let b = ""; res.on("data", (c) => (b += c));
  res.on("end", () => { console.log(`[${ms()}] REFUSED HTTP ${res.statusCode} ${b.slice(0, 300)}`); done("refused"); });
});
ws.on("error", (e) => console.log(`[${ms()}] ws error: ${e.message}`));
ws.on("close", (c, r) => { console.log(`[${ms()}] closed ${c} ${r}`); done("closed"); });
ws.on("open", () => {
  console.log(`[${ms()}] open`);
  send(instructions("ALPHA"));
  ask("Hello, how are you today?");
});
ws.on("message", (data) => {
  const ev = JSON.parse(data.toString());
  if (!ev.type?.includes("delta")) console.log(`[${ms()}] ${ev.type}`);
  if (ev.type === "error") console.log("  error:", JSON.stringify(ev.error ?? ev).slice(0, 300));
  const i = Math.min(responses, 1);
  if (ev.type?.endsWith("text.delta") || ev.type?.endsWith("transcript.delta")) replies[i] += ev.delta ?? "";
  if (ev.type === "response.done") {
    if (!replies[i]) for (const o of ev.response?.output ?? []) for (const c of o.content ?? []) replies[i] += c.text ?? c.transcript ?? "";
    console.log(`  response.done #${responses + 1} status=${ev.response?.status} text=${JSON.stringify(replies[i])}`);
    if (!replies[i]) return; // an empty follow-up response.done; wait for the real one
    responses++;
    if (responses === 1) {
      send(instructions("BRAVO"));
      ask("What is your favourite colour?");
    } else done("second reply received");
  }
});
