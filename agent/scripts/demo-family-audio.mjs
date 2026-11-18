// Records the demo family's lines (public/demo-family-logic.mjs) with ElevenLabs voices through the team proxy,
// once, into data/demo-family/<id>.mp3 + manifest.json. Lines already recorded with the same text and voice are
// skipped, so running it again costs nothing.
// Usage (from agent/): node --env-file=../.env scripts/demo-family-audio.mjs
// Voices: DEMO_VOICE_DANIEL / DEMO_VOICE_EMILY (ElevenLabs voice ids), model DEMO_TTS_MODEL (default eleven-v3).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { LINES } from '../public/demo-family-logic.mjs';

const BASE = (process.env.LLM_PROXY_URL || 'https://llm-hackathon.sherpaswealth.com').replace(/\/$/, '');
const KEY = process.env.TEAM_KEY;
if (!KEY) { console.error('TEAM_KEY missing (run with --env-file=../.env)'); process.exit(1); }
const VOICES = {
  Daniel: process.env.DEMO_VOICE_DANIEL || 'iP95p4xoKVk53GoZ742B', // ElevenLabs "Chris": relaxed American male
  Emily: process.env.DEMO_VOICE_EMILY || 'cgSgspJ2msm6clMCkdW9', // ElevenLabs "Jessica": warm American female
};
const MODEL = process.env.DEMO_TTS_MODEL || 'eleven-v3';
const DIR = new URL('../data/demo-family/', import.meta.url);
mkdirSync(DIR, { recursive: true });
const manifestUrl = new URL('manifest.json', DIR);
const old = existsSync(manifestUrl) ? JSON.parse(readFileSync(manifestUrl, 'utf8')) : { lines: [] };

const out = [];
let chars = 0;
for (const l of LINES) {
  const voice = VOICES[l.who];
  const prev = old.lines.find((x) => x.id === l.id);
  const file = `${l.id}.mp3`;
  if (prev && prev.text === l.text && prev.voice === voice && prev.model === MODEL && existsSync(new URL(file, DIR))) {
    out.push(prev); continue;
  }
  const res = await fetch(`${BASE}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, voice, input: l.text }),
  });
  if (!res.ok) { console.error(`${l.id}: HTTP ${res.status}`); process.exit(1); }
  writeFileSync(new URL(file, DIR), Buffer.from(await res.arrayBuffer()));
  chars += l.text.length;
  out.push({ id: l.id, who: l.who, text: l.text, voice, model: MODEL, file });
  console.log(`recorded ${l.id} (${l.who})`);
}
writeFileSync(manifestUrl, JSON.stringify({ lines: out }, null, 2) + '\n');
console.log(`done: ${out.length} lines, ${chars} new characters`);
