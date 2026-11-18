// Sherpy voice server: serves the page and relays /voice?case=<id> to the realtime proxy.
//
//   cd agent && npm start      (node --env-file=../.env server.mjs)  ->  http://localhost:5173
//
// Secrets (TEAM_KEY, MCP_TOKEN) stay in this process. The page never sees them or the case data;
// it only gets audio, transcripts and the relayed realtime events.
import { createServer } from 'node:http';
import { readFileSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { connectMcp, createCaseSource, withReconnect } from './src/case-source.mjs';
import { createSession, isAllowedCase } from './src/session.mjs';
import { isAllowedOrigin } from './src/origin.mjs';
import { createVideoBuilder } from './src/video/build.mjs';
import { speech } from './src/video/voice.mjs';
import { chatComplete } from './src/video/narrate.mjs';
import { parseRange, parseVideoPath, videoView } from './src/video/routes.mjs';
import { loadMissions } from './src/game/missions.mjs';
import { parseMissionsPath, missionsView } from './src/game/routes.mjs';
import { parseJourneyPath, journeyView } from './src/journey.mjs';
import { loadProfile } from './src/profile.mjs';

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
const videosDir = join(repo, 'data', 'videos');

const missing = ['TEAM_KEY', 'MCP_URL', 'MCP_TOKEN'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing in the root .env: ${missing.join(', ')}. Run with: node --env-file=../.env server.mjs`);
  process.exit(1);
}

const mcp = withReconnect(() => connectMcp(MCP_URL, MCP_TOKEN));
const source = createCaseSource(mcp);
const caseIds = await source.listCaseIds(); // cached: the allow-list for /voice

const builder = createVideoBuilder({
  source,
  profilesDir,
  videosDir,
  complete: chatComplete({ baseUrl: PROXY_URL, key: TEAM_KEY }),
  tts: speech({ baseUrl: PROXY_URL, key: TEAM_KEY, voice: process.env.SHERPY_VOICE || 'onyx' }),
  voice: process.env.SHERPY_VOICE || 'onyx',
});

// "daniel-emily-johnson" -> "Daniel & Emily Johnson". Built from the id only, no case data.
function caseLabel(id) {
  const words = id.split('-').map((w) => w[0].toUpperCase() + w.slice(1));
  return words.length > 2 ? `${words.slice(0, -1).join(' & ')} ${words.at(-1)}` : words.join(' ');
}

const files = {
  '/': [join(here, 'public', 'index.html'), 'text/html; charset=utf-8'],
  '/bench.html': [join(here, 'public', 'bench.html'), 'text/html; charset=utf-8'],
  '/conversation.css': [join(here, 'public', 'conversation.css'), 'text/css; charset=utf-8'],
  '/conversation.mjs': [join(here, 'public', 'conversation.mjs'), 'text/javascript; charset=utf-8'],
  '/conversation-logic.mjs': [join(here, 'public', 'conversation-logic.mjs'), 'text/javascript; charset=utf-8'],
  '/voice-client.mjs': [join(here, 'public', 'voice-client.mjs'), 'text/javascript; charset=utf-8'],
  '/mic-worklet.js': [join(here, 'public', 'mic-worklet.js'), 'text/javascript; charset=utf-8'],
  '/speech-gate.mjs': [join(here, 'public', 'speech-gate.mjs'), 'text/javascript; charset=utf-8'],
  '/half-duplex.mjs': [join(here, 'public', 'half-duplex.mjs'), 'text/javascript; charset=utf-8'],
  '/tokens.css': [join(repo, 'assets', 'brand', 'tokens.css'), 'text/css; charset=utf-8'],
  '/sherpas-logo.svg': [join(repo, 'assets', 'brand', 'sherpas-logo.svg'), 'image/svg+xml'],
  '/sherpy.svg': [join(repo, 'assets', 'mascot', 'sherpy.svg'), 'image/svg+xml'],
  '/video.html': [join(here, 'public', 'video.html'), 'text/html; charset=utf-8'],
  '/video-player.mjs': [join(here, 'public', 'video-player.mjs'), 'text/javascript; charset=utf-8'],
  '/video-stage.mjs': [join(here, 'public', 'video-stage.mjs'), 'text/javascript; charset=utf-8'],
  '/video-shapes.mjs': [join(here, 'public', 'video-shapes.mjs'), 'text/javascript; charset=utf-8'],
  '/video-time.mjs': [join(here, 'public', 'video-time.mjs'), 'text/javascript; charset=utf-8'],
  '/journey-logic.mjs': [join(here, 'public', 'journey-logic.mjs'), 'text/javascript; charset=utf-8'],
  '/handoff.mjs': [join(here, 'public', 'handoff.mjs'), 'text/javascript; charset=utf-8'],
  '/journey-nav.mjs': [join(here, 'public', 'journey-nav.mjs'), 'text/javascript; charset=utf-8'],
  '/sherpy-chat.mjs': [join(here, 'public', 'sherpy-chat.mjs'), 'text/javascript; charset=utf-8'],
  '/missions.html': [join(here, 'public', 'missions.html'), 'text/html; charset=utf-8'],
  '/missions.css': [join(here, 'public', 'missions.css'), 'text/css; charset=utf-8'],
  '/missions.mjs': [join(here, 'public', 'missions.mjs'), 'text/javascript; charset=utf-8'],
  '/missions-logic.mjs': [join(here, 'public', 'missions-logic.mjs'), 'text/javascript; charset=utf-8'],
  '/game-score.mjs': [join(here, 'src', 'game', 'score.mjs'), 'text/javascript; charset=utf-8'],
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function serveAudio(req, res, { caseId, audio }) {
  const built = await builder.peek(caseId); // never builds: only GET /video/<case> may spend
  const name = built?.video.scenes[audio]?.audio;
  if (!name) return res.writeHead(404).end('not found');
  const file = join(built.dir, name);
  let size;
  try {
    size = (await stat(file)).size;
  } catch {
    return res.writeHead(404).end('not found');
  }
  const headers = {
    'content-type': 'audio/mpeg',
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=31536000, immutable', // the directory name carries the content hash
  };
  const range = parseRange(req.headers.range, size);
  if (range === 'unsatisfiable') return res.writeHead(416, { ...headers, 'content-range': `bytes */${size}` }).end();
  const [status, opts] = range
    ? [206, { start: range.start, end: range.end }]
    : [200, {}];
  const length = range ? range.end - range.start + 1 : size;
  res.writeHead(status, {
    ...headers,
    'content-length': length,
    ...(range && { 'content-range': `bytes ${range.start}-${range.end}/${size}` }),
  });
  const stream = createReadStream(file, opts);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

async function serveVideoJson(res, { caseId }) {
  try {
    return sendJson(res, 200, videoView(await builder.get(caseId)));
  } catch (e) {
    if (e?.code === 'profile_incomplete') return sendJson(res, 409, { error: 'profile_incomplete' });
    throw e;
  }
}

function handleVideo(req, res, parsed) {
  (parsed.audio === null ? serveVideoJson(res, parsed) : serveAudio(req, res, parsed)).catch((e) => {
    console.error(`[${parsed.caseId}] video request failed: ${e?.message}`);
    if (res.headersSent) res.destroy();
    else sendJson(res, 500, { error: 'video_failed' });
  });
}

async function serveMissions(res, caseId) {
  try {
    sendJson(res, 200, missionsView(await loadMissions(source, caseId), caseLabel(caseId)));
  } catch (e) {
    console.error(`[${caseId}] missions failed: ${e?.message}`);
    if (res.headersSent) res.destroy();
    else sendJson(res, 500, { error: 'missions_failed' });
  }
}

const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/config') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ model: MODEL, cases: caseIds.filter((id) => isAllowedCase(id, caseIds)).map((id) => ({ id, label: caseLabel(id) })) }));
  }
  const journeyCase = parseJourneyPath(pathname, caseIds);
  if (journeyCase) {
    return void loadProfile(profilesDir, journeyCase, []).then(
      (p) => sendJson(res, 200, journeyView(p)),
      () => sendJson(res, 200, journeyView(null)),
    );
  }
  const missionsCase = parseMissionsPath(pathname, caseIds);
  if (missionsCase) return void serveMissions(res, missionsCase);
  const video = parseVideoPath(pathname, caseIds);
  if (video) return void handleVideo(req, res, video);
  const file = files[pathname];
  if (!file) return res.writeHead(404).end('not found');
  try {
    const body = readFileSync(file[0]);
    res.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store' });
    res.end(body);
  } catch (e) {
    if (e?.code === 'ENOENT') res.writeHead(404).end('not found');
    else res.writeHead(500).end('error');
  }
});

const wss = new WebSocketServer({
  server,
  path: '/voice',
  maxPayload: 1024 * 1024,
  verifyClient: ({ origin }) => isAllowedOrigin(origin, PORT),
});
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

  createSession({
    browser, upstream, caseId, source, profilesDir, transcriptsDir,
    onFinished: (id) => { builder.get(id).catch((e) => console.error(`[${id}] video build failed: ${e?.message}`)); }, // start building while the closing line plays
  }).catch((e) => {
    console.error(`[${caseId}] session failed:`, e?.message);
    browser.close();
    upstream.close();
  });
});

server.listen(PORT, '127.0.0.1', () => {
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
