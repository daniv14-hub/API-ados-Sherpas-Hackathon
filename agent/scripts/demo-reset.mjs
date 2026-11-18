// Puts a case back to "never talked to Sherpy" for a recording (team, 18/11). Moves, never deletes:
// the saved profile and the case's built videos go to data/archive/reset-<time>/, so the conversation starts from
// "Hi, I'm Sherpy" and the video is built live again (a few cents of TTS). Hand-written missions are not touched.
// Then restart the server (it also forgets the Ask Sherpy chat memory) and open /reset.html in the browser
// to clear the missions progress saved there.
// Usage (from agent/): node scripts/demo-reset.mjs [caseId]   (default daniel-emily-johnson)
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSafeCaseId } from '../src/profile.mjs';

const caseId = process.argv[2] || 'daniel-emily-johnson';
if (!isSafeCaseId(caseId)) { console.error(`unsafe case id: ${caseId}`); process.exit(1); }
const data = fileURLToPath(new URL('../../data/', import.meta.url)); // fileURLToPath: also right on Windows
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = join(data, 'archive', `reset-${stamp}`);
const moves = [];
const profile = join(data, 'profiles', `${caseId}.json`);
if (existsSync(profile)) moves.push([profile, join(dest, `${caseId}.profile.json`)]);
const videos = join(data, 'videos');
if (existsSync(videos)) for (const d of readdirSync(videos)) if (d.startsWith(`${caseId}-`)) moves.push([join(videos, d), join(dest, 'videos', d)]);
if (!moves.length) { console.log(`${caseId}: already clean, nothing to move`); process.exit(0); }
mkdirSync(join(dest, 'videos'), { recursive: true });
for (const [from, to] of moves) { renameSync(from, to); console.log(`moved ${from.replace(data, 'data/')} -> ${to.replace(data, 'data/')}`); }
console.log(`\n${caseId} reset. Now: restart the server, then open http://localhost:5173/reset.html`);
