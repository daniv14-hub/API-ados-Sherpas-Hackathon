// Sherpy voice server: serves the page and relays /voice?case=<id> to the realtime proxy.
//
//   cd agent && npm start      (node --env-file=../.env server.mjs)  ->  http://localhost:5173
//
// Secrets (TEAM_KEY, MCP_TOKEN) stay in this process. The page never sees them or the case data;
// it only gets audio, transcripts and the relayed realtime events.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { connectMcp, createCaseSource } from './src/case-source.mjs';
import { createSession, isAllowedCase } from './src/session.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const PROXY_URL = (process.env.LLM_PROXY_URL || 'https://llm-hackathon.sherpaswealth.com').replace(/\/$/, '');
const TEAM_KEY = process.env.TEAM_KEY;
const MCP_URL = process.env.MCP_URL;
const MCP_TOKEN = process.env.MCP_TOKEN;
const PORT = Number(process.env.PORT || 5173);
const MODEL = process.env.MODEL || 'gemini-3.8-live';
const profilesDir = join(repo, 'data', 'profiles');
const transcriptsDir = join(repo, 'data', 'transcripts');

const missing = ['TEAM_KEY', 'MCP_URL', 'MCP_TOKEN'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing in the root .env: ${missing.join(', ')}. Run with: node --env-file=../.env server.mjs`);
  process.exit(1);
}

const mcp = await connectMcp(MCP_URL, MCP_TOKEN);
const source = createCaseSource(mcp);
const caseIds = await source.listCaseIds(); // cached: the allow-list for /voice

// "daniel-emily-johnson" -> "Daniel & Emily Johnson". Built from the id only, no case data.
function caseLabel(id) {
  const words = id.split('-').map((w) => w[0].toUpperCase() + w.slice(1));
  return words.length > 2 ? `${words.slice(0, -1).join(' & ')} ${words.at(-1)}` : words.join(' ');
}

const files = {
  '/': [join(here, 'public', 'index.html'), 'text/html; charset=utf-8'],
  '/mic-worklet.js': [join(here, 'public', 'mic-worklet.js'), 'text/javascript; charset=utf-8'],
  '/tokens.css': [join(repo, 'assets', 'brand', 'tokens.css'), 'text/css; charset=utf-8'],
  '/sherpas-logo.svg': [join(repo, 'assets', 'brand', 'sherpas-logo.svg'), 'image/svg+xml'],
};

const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/config') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ model: MODEL, cases: caseIds.filter((id) => isAllowedCase(id, caseIds)).map((id) => ({ id, label: caseLabel(id) })) }));
  }
  const file = files[pathname];
  if (!file) return res.writeHead(404).end('not found');
  try {
    const body = readFileSync(file[0]);
    res.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(500).end('error');
  }
});

const wss = new WebSocketServer({ server, path: '/voice' });
wss.on('connection', (browser, req) => {
  const caseId = new URL(req.url, 'http://localhost').searchParams.get('case');
  // Refuse before any MCP or file access.
  if (!isAllowedCase(caseId, caseIds)) return browser.close(1008, 'unknown case');

  const upstream = new WebSocket(`${PROXY_URL.replace(/^http/, 'ws')}/v1/realtime?model=${encodeURIComponent(MODEL)}`, {
    headers: { Authorization: `Bearer ${TEAM_KEY}` },
  });
  console.log(`[${caseId}] session opened (${MODEL})`);
  upstream.on('error', (e) => console.log(`[${caseId}] proxy error ${e.message}`));
  upstream.on('unexpected-response', (_req, res) => {
    console.log(`[${caseId}] proxy refused: HTTP ${res.statusCode}`);
    res.resume();
    if (browser.readyState === WebSocket.OPEN) {
      browser.send(JSON.stringify({ type: 'error', error: { message: `proxy HTTP ${res.statusCode}` } }));
    }
    browser.close();
  });
  upstream.on('close', (code) => console.log(`[${caseId}] proxy closed ${code}`));
  browser.on('error', (e) => console.log(`[${caseId}] browser error ${e.message}`));
  browser.on('close', () => console.log(`[${caseId}] session closed`));

  createSession({ browser, upstream, caseId, source, profilesDir, transcriptsDir }).catch((e) => {
    console.error(`[${caseId}] session failed:`, e?.message);
    browser.close();
    upstream.close();
  });
});

server.listen(PORT, () => {
  console.log(`Sherpy on http://localhost:${PORT}  (model ${MODEL}, ${caseIds.length} cases from MCP)`);
});

async function shutdown() {
  for (const c of wss.clients) c.close();
  server.close();
  await mcp.close().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
