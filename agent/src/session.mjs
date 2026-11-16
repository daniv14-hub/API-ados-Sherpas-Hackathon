// One voice session: relays events between the page and the realtime proxy, owns Sherpy's
// instructions and tools, runs tool calls and writes the transcript.
// One upstream session covers both phases (R10): the phase is fixed at start from the saved
// profile, because the proxy ignores a mid-session session.update (scripts/check-phase-switch.mjs).
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
const DEFAULT_AUDIO = {
  input: { format: { type: 'audio/pcm', rate: 24000 }, turn_detection: { type: 'server_vad', silence_duration_ms: 600 } },
  output: { format: { type: 'audio/pcm', rate: 24000 } },
};
const USER_DONE = 'conversation.item.input_audio_transcription.completed';
// Team choice 16/11 (D16): the proxy honours audio.output.voice for Gemini.
export const VOICE = 'Charon';
// Sherpy speaks first, in English, instead of waiting for the first sound (a breath or cough was
// transcribed as "¿Qué?" and made it start in Spanish, devlog 16/11 21:35).
const KICKOFF = '(The family has just joined the call. Start the conversation now, in English.)';

function withVoice(audio) {
  const a = audio && typeof audio === 'object' ? structuredClone(audio) : structuredClone(DEFAULT_AUDIO);
  a.output = { ...(a.output && typeof a.output === 'object' ? a.output : DEFAULT_AUDIO.output), voice: VOICE };
  return a;
}

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
  let sentSessionUpdate = false;
  let kickedOff = false;
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

  // Page events are parsed and rebuilt from an allow-list: the page can never send its own
  // instructions, tools, system items or fake tool outputs to the model.
  function fromPage(raw) {
    const ev = parse(raw);
    if (!ev || typeof ev.type !== 'string') {
      log.log(`[${caseId}] dropped unparsable page message`);
      return null;
    }
    switch (ev.type) {
      case 'input_audio_buffer.append':
        return typeof ev.audio === 'string' ? { type: ev.type, audio: ev.audio } : null;
      case 'input_audio_buffer.commit':
      case 'input_audio_buffer.clear':
      case 'response.cancel':
      case 'response.create':
        return { type: ev.type };
      case 'conversation.item.truncate':
        return { type: ev.type, item_id: ev.item_id, content_index: ev.content_index, audio_end_ms: ev.audio_end_ms };
      case 'session.update': {
        sentSessionUpdate = true;
        const session = { type: 'realtime', ...sessionConfig() };
        session.audio = withVoice(ev.session && typeof ev.session === 'object' ? ev.session.audio : undefined);
        return { type: ev.type, session };
      }
      default:
        log.log(`[${caseId}] dropped page event ${String(ev.type).slice(0, 80)}`);
        return null;
    }
  }

  function flush() {
    if (!ready || !isOpen(upstream)) return;
    const queued = pending.splice(0).map(fromPage).filter(Boolean);
    // Sherpy never runs without its rules: if the page sent no session.update, send ours first.
    if (!sentSessionUpdate && !queued.some((e) => e.type === 'session.update')) {
      sentSessionUpdate = true;
      upstream.send(JSON.stringify({ type: 'session.update', session: { type: 'realtime', ...sessionConfig(), audio: withVoice() } }));
      kickoff();
    }
    for (const e of queued) {
      upstream.send(JSON.stringify(e));
      if (e.type === 'session.update') kickoff();
    }
  }

  function kickoff() {
    if (kickedOff) return;
    kickedOff = true;
    upstream.send(JSON.stringify({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: KICKOFF }] },
    }));
    upstream.send(JSON.stringify({ type: 'response.create' }));
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
    for (const call of calls) {
      if (ended) return;
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
      const all = (ev.response?.output ?? []).filter((o) => o?.type === 'function_call');
      const calls = all.filter((c) => {
        if (typeof c.call_id === 'string' && c.call_id) return true;
        log.log(`[${caseId}] function_call without call_id`);
        return false;
      });
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
    let raw = data.toString();
    const ev = parse(raw);
    // session.* events echo our instructions and tools: never let them reach the page.
    if (ev && typeof ev.type === 'string' && ev.type.startsWith('session.') && ev.session && typeof ev.session === 'object') {
      delete ev.session.instructions;
      delete ev.session.tools;
      raw = JSON.stringify(ev);
    }
    if (isOpen(browser)) browser.send(raw);
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
