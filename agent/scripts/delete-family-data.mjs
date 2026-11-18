// Right to erasure (docs/privacy.md): deletes everything this computer stored about one family — the saved
// conversation answers, built videos, any transcripts and archived copies. Cannot be undone, so it asks for --yes.
// What the family typed in the missions lives only in their browser: clear it with http://localhost:5173/reset.html.
// Usage (from agent/): npm run data:delete -- <caseId> --yes
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSafeCaseId } from '../src/profile.mjs';

const caseId = process.argv[2];
if (!caseId || !isSafeCaseId(caseId)) { console.error('usage: npm run data:delete -- <caseId> --yes'); process.exit(1); }
const data = fileURLToPath(new URL('../../data/', import.meta.url));
const targets = [];
const walk = (dir, depth = 0) => {
  if (!existsSync(dir) || depth > 3) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name.startsWith(`${caseId}-`) || name.startsWith(`${caseId}.`) || name === caseId) targets.push(p);
    else if (statSync(p).isDirectory()) walk(p, depth + 1);
  }
};
for (const sub of ['profiles', 'videos', 'transcripts', 'archive']) walk(join(data, sub));
if (!targets.length) { console.log(`Nothing stored for ${caseId}.`); process.exit(0); }
console.log(`Stored data for ${caseId}:\n${targets.map((t) => `  ${t.replace(data, 'data/')}`).join('\n')}`);
if (!process.argv.includes('--yes')) { console.log('\nNothing deleted. Run again with --yes to delete it.'); process.exit(0); }
for (const t of targets) rmSync(t, { recursive: true, force: true });
console.log(`\nDeleted ${targets.length} item(s). Restart the server to also clear its memory of the Ask Sherpy chat.`);
