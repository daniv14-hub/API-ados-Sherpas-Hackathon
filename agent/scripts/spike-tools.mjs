// Throwaway spike: does a realtime model on the proxy do function calling? Usage: node --env-file=../.env scripts/spike-tools.mjs <model>
import { WebSocket } from "ws";

const model = process.argv[2];
const noResponseCreate = process.argv.includes("--no-response-create");
if (!model) throw new Error("usage: spike-tools.mjs <model>");
const base = (process.env.LLM_PROXY_URL || "https://llm-hackathon.sherpaswealth.com").replace(/\/$/, "").replace(/^http/, "ws");
const t0 = Date.now();
const ms = () => `${Date.now() - t0}ms`;
const ws = new WebSocket(`${base}/v1/realtime?model=${model}`, { headers: { Authorization: `Bearer ${process.env.TEAM_KEY}` } });
const seen = [];
let callAt = null, followText = "", finished = false, responses = 0;

function done(why) {
  if (finished) return;
  finished = true;
  console.log(`[${ms()}] finish: ${why}`);
  console.log("event types:", [...new Set(seen)].join(", "));
  console.log(`RESULT model=${model} function_call_ms=${callAt} followup=${JSON.stringify(followText)}`);
  try { ws.close(); } catch {}
  setTimeout(() => process.exit(0), 500);
}
const timer = setTimeout(() => done("timeout 20s"), 20000);
timer.unref?.();
const send = (o) => ws.send(JSON.stringify(o));

ws.on("unexpected-response", (_r, res) => {
  let b = ""; res.on("data", (c) => (b += c));
  res.on("end", () => { console.log(`[${ms()}] REFUSED HTTP ${res.statusCode} ${b.slice(0, 300)}`); done("refused"); });
});
ws.on("error", (e) => console.log(`[${ms()}] ws error: ${e.message}`));
ws.on("close", (c, r) => { console.log(`[${ms()}] closed ${c} ${r}`); done("closed"); });
ws.on("open", () => {
  console.log(`[${ms()}] open`);
  send({ type: "session.update", session: {
    type: "realtime", output_modalities: ["text"],
    instructions: "When the user states their main goal, call save_answer.",
    tools: [{ type: "function", name: "save_answer", description: "Save the user's answer to a question.",
      parameters: { type: "object", properties: { question: { type: "string" }, person: { type: "string" }, value: { type: "string" } }, required: ["question", "person", "value"] } }],
    tool_choice: "auto",
  } });
  send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "Hi, I'm Daniel. Our main goal is college for the kids." }] } });
  send({ type: "response.create" });
});
ws.on("message", (data) => {
  const ev = JSON.parse(data.toString());
  seen.push(ev.type);
  console.log(`[${ms()}] ${ev.type}`);
  if (ev.type === "error") console.log("  error:", JSON.stringify(ev.error ?? ev).slice(0, 300));
  if ((ev.type?.endsWith("text.delta") || ev.type?.endsWith("transcript.delta")) && responses >= 1) followText += ev.delta ?? "";
  if (ev.type === "response.done") {
    responses++;
    const out = ev.response?.output ?? [];
    const calls = out.filter((i) => i.type === "function_call");
    console.log(`  response.done #${responses} status=${ev.response?.status} output types=${out.map((i) => i.type)}`);
    if (calls.length && responses === 1) {
      callAt = Date.now() - t0;
      for (const c of calls) console.log(`  FUNCTION_CALL name=${c.name} call_id=${c.call_id} arguments=${c.arguments}`);
      send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: calls[0].call_id, output: JSON.stringify({ saved: true }) } });
      if (!noResponseCreate) send({ type: "response.create" });
      else console.log("  (not sending response.create after tool output)");
    } else {
      for (const i of out) for (const c of i.content ?? []) { const t = c.text ?? c.transcript; if (t) followText ||= t; }
      console.log(`  text: ${followText}`);
      done(callAt ? "followup done" : "no function call");
    }
  }
});
