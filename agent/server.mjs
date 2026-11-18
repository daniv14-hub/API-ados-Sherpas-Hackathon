// Sherpy voice server: serves the page and relays /voice?case=<id> to the realtime proxy.
//
//   cd agent && npm start      (node --env-file=../.env server.mjs)  ->  http://localhost:5173
//
// Secrets (TEAM_KEY, MCP_TOKEN) stay in this process. The page never sees them or the case data;
// it only gets audio, transcripts and the relayed realtime events.
// HOW THE APP FITS TOGETHER (start here when reading the code)
//   1. Conversation  (public/index.html + conversation.mjs): Sherpy talks with the family by voice and saves
//      their answers (profile) through tool calls handled in src/session.mjs + src/tools.mjs.
//   2. Video          (public/video.html + video-player.mjs): built on the server by src/video/* from the
//      plan facts + the profile, then played in the browser as animated scenes with narration.
//   3. Missions       (public/missions.html + missions.mjs): the plan turned into guided steps, from
//      data/missions/<case>.json (hand-written) or src/game/generate.mjs (any other case).
// This file wires everything: configuration, case data source, HTTP routes, the /voice WebSocket relay,
// security layers (headers, Host/Origin checks, rate limits) and data retention.
import { createServer } from 'node:http';
import { readFileSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { connectMcp, createCaseSource, createLocalCaseSource, withReconnect } from './src/case-source.mjs';
import { createSession, isAllowedCase } from './src/session.mjs';
import { isAllowedOrigin, isAllowedHost } from './src/origin.mjs';
import { securityHeaders, createRateLimiter, ALLOWED_METHODS } from './src/security.mjs';
import { createVideoBuilder } from './src/video/build.mjs';
import { speech } from './src/video/voice.mjs';
import { chatComplete } from './src/video/narrate.mjs';
import { parseRange, parseVideoPath, videoView } from './src/video/routes.mjs';
import { loadMissions } from './src/game/missions.mjs';
import { parseMissionsPath, missionsView } from './src/game/routes.mjs';
import { parseJourneyPath, journeyView } from './src/journey.mjs';
import { createChatMemory } from './src/chat-memory.mjs';
import { purgeOlderThan } from './src/privacy.mjs';
const chatMemory = createChatMemory();
import { loadProfile } from './src/profile.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
// Configuration from the root .env (loaded by `node --env-file=../.env`). Only TEAM_KEY is required.
const PROXY_URL = (process.env.LLM_PROXY_URL || 'https://llm-hackathon.sherpaswealth.com').replace(/\/$/, '');
const TEAM_KEY = process.env.TEAM_KEY;
const MCP_URL = process.env.MCP_URL;
const MCP_TOKEN = process.env.MCP_TOKEN;
const PORT = Number(process.env.PORT || 5173);
const MODEL = process.env.MODEL || 'gemini-3.8-live';
const profilesDir = join(repo, 'data', 'profiles');
const transcriptsDir = join(repo, 'data', 'transcripts');
const videosDir = join(repo, 'data', 'videos');

if (!process.env.TEAM_KEY) {
  console.error('Missing TEAM_KEY in the root .env (the AI proxy key). Run with: node --env-file=../.env server.mjs');
  process.exit(1);
}

// Case data: the Sherpas MCP when a token is set and works; otherwise the same JSON from the repo's cases/ folder
// (the MCP token is personal and lasts 72 h; the files never expire, so anyone can run this later).
let mcp = null;
// `source` is the case data provider: getPart(caseId, part) and listCaseIds(). Two implementations with
// the same interface live in src/case-source.mjs (live MCP, or the JSON files in cases/).
let source = null;
let caseIds = null;
if (MCP_URL && MCP_TOKEN) {
  try {
    mcp = withReconnect(() => connectMcp(MCP_URL, MCP_TOKEN));
    source = createCaseSource(mcp);
    caseIds = await source.listCaseIds(); // cached: the allow-list for /voice
  } catch (e) {
    console.warn(`MCP unavailable (${e?.message ?? e}); reading the cases from cases/ instead.`);
    await mcp?.close?.().catch(() => {});
    mcp = null; source = null;
  }
}
if (!source) {
  source = createLocalCaseSource(join(repo, 'cases'));
  caseIds = await source.listCaseIds();
}
// Label printed at start-up so whoever runs the app knows where the case data comes from.
const CASE_SOURCE = mcp ? 'MCP' : 'cases/ folder';

// Data protection (docs/privacy.md): transcripts are off unless SAVE_TRANSCRIPTS=1; kept files expire.
const SAVE_TRANSCRIPTS = process.env.SAVE_TRANSCRIPTS === '1';
// Retention: expired transcripts (7 days) and archived copies (30 days) are deleted at every start.
const DAY = 24 * 60 * 60 * 1000;
const purged = (await purgeOlderThan(transcriptsDir, 7 * DAY)) + (await purgeOlderThan(join(repo, 'data', 'archive'), 30 * DAY));
if (purged) console.log(`retention: deleted ${purged} expired transcript/archive item(s)`);

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
  '/phone.html': [join(here, 'public', 'phone.html'), 'text/html; charset=utf-8'],
  '/reset.html': [join(here, 'public', 'reset.html'), 'text/html; charset=utf-8'],
  '/privacy.html': [join(here, 'public', 'privacy.html'), 'text/html; charset=utf-8'],
  '/demo-family-logic.mjs': [join(here, 'public', 'demo-family-logic.mjs'), 'text/javascript; charset=utf-8'],
  '/demo-family.mjs': [join(here, 'public', 'demo-family.mjs'), 'text/javascript; charset=utf-8'],
  '/frame-guard.js': [join(here, 'public', 'frame-guard.js'), 'text/javascript; charset=utf-8'],
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
  '/step-logic.mjs': [join(here, 'public', 'step-logic.mjs'), 'text/javascript; charset=utf-8'],
  '/step-ui.mjs': [join(here, 'public', 'step-ui.mjs'), 'text/javascript; charset=utf-8'],
  '/game-score.mjs': [join(here, 'src', 'game', 'score.mjs'), 'text/javascript; charset=utf-8'],
};

// Small helper: JSON response that browsers must never cache.
function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

// Serves one narration clip of an already built video (supports HTTP Range so the <audio> element can seek).
// It never builds anything: only GET /video/<case> may spend money on TTS.
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

// GET /video/<case>: returns the video (scenes + captions + audio URLs), building it on first request.
// 409 = the conversation is not finished yet (profile incomplete); 500 = build failed.
async function serveVideoJson(res, { caseId }) {
  try {
    return sendJson(res, 200, videoView(await builder.get(caseId)));
  } catch (e) {
    if (e?.code === 'profile_incomplete') return sendJson(res, 409, { error: 'profile_incomplete' });
    throw e;
  }
}

// Router for the two video URLs: the JSON (audio === null) or one audio clip.
function handleVideo(req, res, parsed) {
  (parsed.audio === null ? serveVideoJson(res, parsed) : serveAudio(req, res, parsed)).catch((e) => {
    console.error(`[${parsed.caseId}] video request failed: ${e?.message}`);
    if (res.headersSent) res.destroy();
    else sendJson(res, 500, { error: 'video_failed' });
  });
}

// GET /missions/<case>: missions, facts and the score table for the missions screen.
async function serveMissions(res, caseId) {
  try {
    sendJson(res, 200, missionsView(await loadMissions(source, caseId), caseLabel(caseId)));
  } catch (e) {
    console.error(`[${caseId}] missions failed: ${e?.message}`);
    if (res.headersSent) res.destroy();
    else sendJson(res, 500, { error: 'missions_failed' });
  }
}

// Rate limits (team request 18/11). Everything runs on one machine, so the limits are per route, not per IP:
// all requests together, video builds (paid TTS/LLM) per case, and new voice sessions (paid realtime audio).
const LIMITS = {
  http: createRateLimiter({ limit: 600, windowMs: 60_000 }),
  video: createRateLimiter({ limit: 20, windowMs: 60_000 }),
  voiceOpen: createRateLimiter({ limit: 12, windowMs: 60_000 }),
};
// Limits that protect the team budget: voice sessions are billed while open and the proxy
// only accepts 4 concurrent requests for the whole team.
const MAX_VOICE_SESSIONS = 3; // the proxy allows 4 concurrent requests for the whole team
const MAX_WS_MESSAGES_PER_SECOND = 300; // the mic sends 50 frames a second
let voiceSessions = 0;
const HEADERS = securityHeaders(PORT);
const tooMany = (res) => res.writeHead(429, { 'retry-after': '60', 'content-type': 'text/plain' }).end('too many requests');

const server = createServer((req, res) => {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
  if (!isAllowedHost(req.headers.host, PORT)) return res.writeHead(421).end('misdirected request');
  if (!ALLOWED_METHODS.has(req.method)) return res.writeHead(405, { allow: 'GET, HEAD' }).end('method not allowed');
  if (!LIMITS.http.hit('all')) return tooMany(res);
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
  if (video && video.audio === null && !LIMITS.video.hit(video.caseId)) return tooMany(res);
  if (video) return void handleVideo(req, res, video);
  // Demo family clips (scripts/demo-family-audio.mjs): fixed names only, nothing from the URL reaches the path.
  const demo = /^\/demo-family\/(manifest\.json|[a-z]+(?:-[a-z]+)*\.mp3)$/.exec(pathname);
  if (demo) {
    try {
      const body = readFileSync(join(here, 'data', 'demo-family', demo[1]));
      res.writeHead(200, { 'content-type': demo[1].endsWith('.json') ? 'application/json' : 'audio/mpeg', 'cache-control': 'no-store' });
      return res.end(body);
    } catch { return res.writeHead(404).end('not found'); }
  }
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
  verifyClient: ({ origin, req }, done) => {
    if (!isAllowedOrigin(origin, PORT) || !isAllowedHost(req.headers.host, PORT)) return done(false, 403);
    if (voiceSessions >= MAX_VOICE_SESSIONS || !LIMITS.voiceOpen.hit('all')) return done(false, 429, 'too many voice sessions');
    done(true);
  },
});
wss.on('connection', (browser, req) => {
  const query = new URL(req.url, 'http://localhost').searchParams;
  const caseId = query.get('case');
  let screen = null; // which missions screen the "Ask Sherpy" chat was opened on (validated in the session)
  try { screen = JSON.parse((query.get('screen') ?? 'null').slice(0, 4000)); } catch { screen = null; }
  // Refuse before any MCP or file access.
  if (!isAllowedCase(caseId, caseIds)) return browser.close(1008, 'unknown case');
  voiceSessions++;
  browser.once('close', () => { voiceSessions--; });
  // Message flood guard: a page sends ~50 audio frames a second; far more than that is not our page.
  let second = 0, count = 0;
  browser.on('message', () => {
    const now = Math.floor(Date.now() / 1000);
    if (now !== second) { second = now; count = 0; }
    if (++count > MAX_WS_MESSAGES_PER_SECOND) browser.close(1008, 'too many messages');
  });

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
    browser, upstream, caseId, source, profilesDir, transcriptsDir, chatMemory, screen, saveTranscripts: SAVE_TRANSCRIPTS,
    loadMissionsView: async (id) => missionsView(await loadMissions(source, id), caseLabel(id)),
    onFinished: (id) => { builder.get(id).catch((e) => console.error(`[${id}] video build failed: ${e?.message}`)); }, // start building while the closing line plays
  }).catch((e) => {
    console.error(`[${caseId}] session failed:`, e?.message);
    browser.close();
    upstream.close();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Sherpy on http://localhost:${PORT}  (model ${MODEL}, ${caseIds.length} cases from ${CASE_SOURCE})`);
});

// Clean exit on Ctrl+C: closes open voice sessions (they are billed) and the MCP connection.
async function shutdown() {
  for (const c of wss.clients) c.close();
  server.close();
  await mcp?.close().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
