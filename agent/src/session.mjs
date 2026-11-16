// One voice session: relays events between the page and the realtime proxy, owns Sherpy's
// instructions and tools, runs tool calls, switches phase and writes the transcript.
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildBrief } from './brief.mjs';
import { buildOptions } from './options.mjs';
import { isSafeCaseId, loadProfile } from './profile.mjs';
import { sherpyInstructions } from './instructions.mjs';
import { toolDefinitions, handleToolCall } from './tools.mjs';

const OPEN = 1;
const CLOSING = 2;

export function isAllowedCase(id, ids) {
  return isSafeCaseId(id) && Array.isArray(ids) && ids.includes(id);
}

const ASSISTANT_DELTA = new Set(['response.output_audio_transcript.delta', 'response.audio_transcript.delta']);
const ASSISTANT_DONE = new Set(['response.output_audio_transcript.done', 'response.audio_transcript.done']);
const USER_DONE = 'conversation.item.input_audio_transcription.completed';

function parse(raw) {
  try {
    const ev = JSON.parse(raw);
    return ev && typeof ev === 'object' ? ev : null;
  } catch {
    return null;
  }
}

export async function createSession({ browser, upstream, caseId, source, profilesDir, transcriptsDir, log = console }) {
  const startISO = new Date().toISOString();
  const transcriptFile = path.join(transcriptsDir, `${caseId}-${startISO.replace(/[:.]/g, '-')}.jsonl`);

  let ready = false;
  let ended = false;
  const pending = []; // page messages waiting for case data and for the upstream socket to open
  const state = { phase: 1, brief: '', options: null, profile: null };
  let toolChain = Promise.resolve(); // tool calls run one at a time so profile updates never race
  let writeChain = Promise.resolve();
  const transcriptBuf = new Map(); // response id -> assistant transcript so far

  const isOpen = (ws) => ws.readyState === OPEN;
  const closeIfOpen = (ws) => {
    if (ws.readyState < CLOSING) ws.close();
  };
  function endBoth() {
    ended = true;
    closeIfOpen(browser);
    closeIfOpen(upstream);
  }
  const sendUp = (obj) => isOpen(upstream) && upstream.send(typeof obj === 'string' ? obj : JSON.stringify(obj));

  function sessionConfig() {
    return {
      instructions: sherpyInstructions({ phase: state.phase, brief: state.brief, profile: state.profile, options: state.options }),
      tools: toolDefinitions(state.phase, state.options),
      tool_choice: 'auto',
    };
  }

  function fromPage(raw) {
    if (!raw.includes('"session.update"')) return raw;
    const ev = parse(raw);
    if (!ev || ev.type !== 'session.update') return raw;
    ev.session = { ...(ev.session ?? {}), ...sessionConfig() };
    return JSON.stringify(ev);
  }

  function flush() {
    if (!ready || !isOpen(upstream)) return;
    for (const m of pending.splice(0)) upstream.send(fromPage(m));
  }

  function writeLine(role, text) {
    if (!text || !text.trim()) return;
    const line = `${JSON.stringify({ t: new Date().toISOString(), role, text })}\n`;
    writeChain = writeChain
      .then(() => fs.mkdir(transcriptsDir, { recursive: true }))
      .then(() => fs.appendFile(transcriptFile, line))
      .catch((e) => log.error('transcript write failed:', e?.message));
  }

  async function runToolCalls(calls) {
    const wasPhase1 = state.phase === 1;
    for (const call of calls) {
      const ctx = { caseId, profile: state.profile, options: state.options, source, profilesDir };
      let result;
      try {
        result = await handleToolCall(call.name, call.arguments ?? '{}', ctx);
      } catch (e) {
        log.error(`tool ${call.name} failed:`, e?.message);
        result = { output: { ok: false, error: 'tool_failed' } };
      }
      if (result.profile) state.profile = result.profile;
      log.log(`[${caseId}] tool ${call.name}`);
      sendUp({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result.output) },
      });
    }
    if (wasPhase1 && state.profile?.phase1Complete) {
      state.phase = 2;
      log.log(`[${caseId}] phase 2`);
      sendUp({ type: 'session.update', session: { type: 'realtime', ...sessionConfig() } });
    }
    // Gemini continues on its own and the proxy drops this; OpenAI models need it.
    sendUp({ type: 'response.create' });
  }

  function onUpstreamEvent(ev) {
    const t = ev.type;
    if (ASSISTANT_DELTA.has(t)) {
      const key = ev.response_id ?? '';
      transcriptBuf.set(key, (transcriptBuf.get(key) ?? '') + (ev.delta ?? ''));
    } else if (ASSISTANT_DONE.has(t)) {
      const key = ev.response_id ?? '';
      writeLine('assistant', ev.transcript ?? transcriptBuf.get(key));
      transcriptBuf.delete(key);
    } else if (t === USER_DONE) {
      writeLine('user', ev.transcript);
    } else if (t === 'response.done') {
      const id = ev.response?.id;
      // Gemini sends no transcript .done: write what the deltas built up for this response.
      const keys = id !== undefined && transcriptBuf.has(id) ? [id] : [...transcriptBuf.keys()];
      for (const k of keys) {
        writeLine('assistant', transcriptBuf.get(k));
        transcriptBuf.delete(k);
      }
      const calls = (ev.response?.output ?? []).filter((o) => o?.type === 'function_call');
      if (calls.length && ready) {
        toolChain = toolChain.then(() => runToolCalls(calls)).catch((e) => log.error('tool handling failed:', e?.message));
      }
    }
  }

  // Listeners go on first, so nothing the page sends while case data loads is lost.
  browser.on('message', (data) => {
    if (ended) return;
    pending.push(data.toString());
    flush();
  });
  browser.on('close', () => {
    ended = true;
    closeIfOpen(upstream);
  });
  upstream.on('open', flush);
  upstream.on('message', (data) => {
    const raw = data.toString();
    if (isOpen(browser)) browser.send(raw);
    const ev = parse(raw);
    if (ev) onUpstreamEvent(ev);
  });
  upstream.on('close', () => {
    ended = true;
    closeIfOpen(browser);
  });

  if (!isSafeCaseId(caseId)) {
    endBoth();
    return;
  }

  try {
    const [fh, personaMd] = await Promise.all([
      source.getPart(caseId, 'financial-health'),
      source.getPart(caseId, 'persona'),
    ]);
    state.brief = buildBrief(fh, personaMd);
    state.options = buildOptions(fh, personaMd);
    state.profile = await loadProfile(profilesDir, caseId, state.options.present);
    state.phase = state.profile.phase1Complete ? 2 : 1;
  } catch (e) {
    // Log only the error, never case data or tokens.
    log.error(`[${caseId}] case data failed:`, e?.name, e?.message);
    if (isOpen(browser)) browser.send(JSON.stringify({ type: 'error', error: { message: 'plan_unavailable' } }));
    endBoth();
    return;
  }
  if (ended) return;
  ready = true;
  log.log(`[${caseId}] session ready, phase ${state.phase}`);
  flush();
}
