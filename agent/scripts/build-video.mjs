// Builds (or loads from cache) the explainer video for one case, with real models, and prints what it did.
//
//   cd agent && node --env-file=../.env scripts/build-video.mjs <caseId> [profile.json]
//
// With a profile file, it is copied to data/profiles/<caseId>.json only if no profile exists yet.
// Costs on a cache miss: one gpt-5-mini call + one ElevenLabs clip per scene (~$0.035 for a 1-minute video).
import fs from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMcp, createCaseSource, withReconnect } from '../src/case-source.mjs';
import { createVideoBuilder } from '../src/video/build.mjs';
import { chatComplete } from '../src/video/narrate.mjs';
import { speech } from '../src/video/voice.mjs';
import { caseNumbers, extractMentions, isGrounded } from '../src/numbers.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [caseId, profileFile] = process.argv.slice(2);
if (!caseId) { console.error('usage: build-video.mjs <caseId> [profile.json]'); process.exit(1); }

const PROXY = (process.env.LLM_PROXY_URL || 'https://llm-hackathon.sherpaswealth.com').replace(/\/$/, '');
const KEY = process.env.TEAM_KEY;
const VOICE = process.env.SHERPY_VOICE || 'onyx';
const profilesDir = join(repo, 'data', 'profiles');

if (profileFile) {
  const target = join(profilesDir, `${caseId}.json`);
  try { await fs.access(target); console.log(`profile exists, keeping ${target}`); }
  catch { await fs.mkdir(profilesDir, { recursive: true }); await fs.copyFile(profileFile, target); console.log(`profile copied to ${target}`); }
}

const spend = async () => {
  const r = await fetch(`${PROXY}/key/info`, { headers: { Authorization: `Bearer ${KEY}` } });
  return (await r.json())?.info?.spend;
};

const t0 = performance.now();
const ms = () => `${((performance.now() - t0) / 1000).toFixed(1)} s`;
const timed = (label, fn) => async (...a) => { const s = performance.now(); try { return await fn(...a); } finally { console.log(`  ${label} ${((performance.now() - s) / 1000).toFixed(1)} s`); } };

const mcp = withReconnect(() => connectMcp(process.env.MCP_URL, process.env.MCP_TOKEN));
const source = createCaseSource(mcp);
let modelReply = null;
const llm = chatComplete({ baseUrl: PROXY, key: KEY });
const builder = createVideoBuilder({
  source,
  profilesDir,
  videosDir: join(repo, 'data', 'videos'),
  complete: timed('gpt-5-mini', async (m) => (modelReply = await llm(m))),
  tts: timed('tts clip', speech({ baseUrl: PROXY, key: KEY, voice: VOICE })),
  voice: VOICE,
});

const before = await spend();
const video = await builder.get(caseId);
console.log(`\nbuilt in ${ms()} (voice ${VOICE})${modelReply === null ? ' — cache hit, no model or TTS calls' : ''}`);

const [fh, ia, persona] = await Promise.all(['financial-health', 'investment-analysis', 'persona'].map((p) => source.getPart(caseId, p)));
const set = caseNumbers(fh, ia, persona);
let bad = 0;
for (const s of video.scenes) {
  const ungrounded = extractMentions(s.text).filter((m) => !isGrounded(m, set)).map((m) => m.raw);
  bad += ungrounded.length;
  console.log(`\n[${s.id}] audio=${s.audio ?? 'NONE'}\n  ${s.text}${ungrounded.length ? `\n  UNGROUNDED: ${ungrounded.join(', ')}` : ''}`);
}
console.log(`\nungrounded numbers: ${bad}`);
if (modelReply !== null) console.log(`model reply used: ${video.scenes.filter((s) => modelReply.includes(s.text.slice(0, 12))).length > 0 ? 'some lines look model-written' : 'check: lines may be templates'}`);
await new Promise((r) => setTimeout(r, 3000));
console.log(`spend: ${before} -> ${await spend()} (key/info updates late)`);
await mcp.close();
