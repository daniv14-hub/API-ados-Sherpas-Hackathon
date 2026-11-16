// Usage: node --env-file=../.env scripts/grounding-check.mjs data/transcripts/<caseId>-<start>.jsonl [--case <id>]
// Flags every number Sherpy (role: assistant) said that is not in the case data. Exit 1 if any.
import fs from 'node:fs/promises';
import path from 'node:path';
import { connectMcp, createCaseSource } from '../src/case-source.mjs';
import { isSafeCaseId } from '../src/profile.mjs';
import { extractMentions, caseNumbers, isGrounded } from '../src/numbers.mjs';

const args = process.argv.slice(2);
const ci = args.indexOf('--case');
const flagCase = ci >= 0 ? args.splice(ci, 2)[1] : undefined;
const file = args[0];
if (!file) {
  console.error('usage: grounding-check.mjs <transcript.jsonl> [--case <id>]');
  process.exit(2);
}
const caseId = flagCase ?? path.basename(file).replace(/-\d{4}-\d{2}-\d{2}T.*$/, '').replace(/\.jsonl$/, '');
if (!isSafeCaseId(caseId)) {
  console.error(`unsafe or unknown case id "${caseId}" (use --case <id>)`);
  process.exit(2);
}

const sentenceOf = (text, index) => {
  let start = 0;
  for (const m of text.slice(0, index).matchAll(/[.?!]\s+/g)) start = m.index + m[0].length;
  const end = text.slice(index).search(/[.?!](\s|$)/);
  return text.slice(start, end < 0 ? text.length : index + end + 1).trim();
};

const lines = (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean);
const { callTool, close } = await connectMcp(process.env.MCP_URL, process.env.MCP_TOKEN);
let flagged = 0;
try {
  const src = createCaseSource({ callTool });
  const [fh, ia, persona] = await Promise.all(
    ['financial-health', 'investment-analysis', 'persona'].map((p) => src.getPart(caseId, p)));
  const set = caseNumbers(fh, ia, persona);
  for (const line of lines) {
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.role !== 'assistant' || typeof row.text !== 'string') continue;
    for (const m of extractMentions(row.text)) {
      if (isGrounded(m, set)) continue;
      flagged++;
      console.log(`NOT IN CASE: ${m.raw} (${m.value}${m.percent ? '%' : ''})  [${row.t}]\n  "${sentenceOf(row.text, m.index)}"`);
    }
  }
} finally {
  await close();
}
console.log(flagged ? `${flagged} number(s) not found in case ${caseId}` : `OK: all assistant numbers grounded in case ${caseId}`);
process.exit(flagged ? 1 : 0);
