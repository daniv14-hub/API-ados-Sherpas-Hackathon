// Demo family (team, 18/11): Daniel and Emily Johnson are pre-recorded ElevenLabs lines
// (scripts/demo-family-audio.mjs). In demo mode the voice client takes its "microphone" frames from here instead
// of the real mic, and the same clip plays out loud so the screen recording hears it. No mic, no echo.
// Which line answers what Sherpy said lives in demo-family-logic.mjs.
import { createFamilyScript } from './demo-family-logic.mjs';

const FLAG = 'sherpas.demoFamily';

// ?family=demo switches demo mode on for this browser (also for the missions bubble later); ?family=off clears it.
export function demoFamilyOn() {
  try {
    const p = new URLSearchParams(location.search).get('family');
    if (p === 'demo') localStorage.setItem(FLAG, '1');
    if (p === 'off') localStorage.removeItem(FLAG);
    return localStorage.getItem(FLAG) === '1';
  } catch { return new URLSearchParams(location.search).get('family') === 'demo'; }
}

// List of recorded lines and their mp3 files, served by the server from agent/data/demo-family/.
export async function loadManifest() {
  const r = await fetch('/demo-family/manifest.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('demo family audio missing: run scripts/demo-family-audio.mjs');
  return (await r.json()).lines;
}

// A frame source for voice-client.mjs: frame() gives the next 20 ms (480 samples at 24 kHz) of the clip being
// spoken, or silence. speak(id) plays a clip and queues its samples; resolves when it has been fully sent.
// onLine({who, text} | null) shows a subtitle while a line plays.
export function createFamilyVoice({ lines, onLine = () => {} }) {
  let ctx = null;
  const buffers = new Map();
  let queue = null; // { pcm: Int16Array, pos, done }
  let last = null;
  let tail = 0; // silence frames still to send after a clip, so the server sees the turn end

  async function attach(audioCtx) {
    ctx = audioCtx;
    await Promise.all(lines.map(async (l) => {
      const data = await (await fetch(`/demo-family/${l.file}`)).arrayBuffer();
      buffers.set(l.id, await ctx.decodeAudioData(data)); // decoded at the context's 24 kHz
    }));
  }

  function frame() {
    const out = new Int16Array(480);
    if (!queue) { if (tail > 0) tail--; return out; }
    const { pcm } = queue;
    const n = Math.min(480, pcm.length - queue.pos);
    out.set(pcm.subarray(queue.pos, queue.pos + n));
    queue.pos += n;
    if (queue.pos >= pcm.length) { const q = queue; queue = null; tail = 50; q.done(); }
    return out;
  }

  function speak(id) {
    const line = lines.find((l) => l.id === id);
    const buf = buffers.get(id);
    if (!line || !buf || !ctx) return Promise.resolve();
    last = id;
    const f = buf.getChannelData(0);
    const pcm = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    onLine({ who: line.who, text: line.text });
    return new Promise((resolve) => {
      queue = { pcm, pos: 0, done: () => { setTimeout(() => onLine(null), 900); resolve(); } };
    });
  }

  return { attach, frame, speak, busy: () => !!queue, last: () => last };
}

// Answers Sherpy on its own: after each Sherpy turn has finished playing and nothing new started for a moment,
// picks the scripted reply. Keys (no visible UI, for the person recording): N = answer now, R = repeat the
// last line, P = pause/resume the autopilot.
export function createAutopilot({ voice, client, script = createFamilyScript(), quietMs = 1300, noQuestionMs = 3500, log = () => {} }) {
  let heard = '';
  let timer = 0;
  let paused = false;
  let doneAll = false;

  function answer() {
    if (doneAll || voice.busy()) return;
    const id = script.reply(heard);
    log(`Sherpy: "${heard.slice(-120)}" -> ${id}`);
    heard = '';
    if (id) voice.speak(id);
  }
  function check() {
    clearTimeout(timer);
    if (paused || doneAll || !heard.trim()) return;
    const s = client.snapshot();
    if (s.speaking || s.thinking || voice.busy()) { timer = setTimeout(check, 200); return; }
    // No question yet ("Got it, I've saved that."): Sherpy is usually about to continue after saving, so wait longer.
    const wait = heard.includes('?') ? quietMs : noQuestionMs;
    timer = setTimeout(() => {
      const t = client.snapshot();
      if (t.speaking || t.thinking || voice.busy()) return check();
      answer();
    }, wait);
  }
  function onKey(e) {
    if (e.target?.closest?.('input, textarea, select')) return;
    if (e.key === 'n' || e.key === 'N') { clearTimeout(timer); answer(); }
    if (e.key === 'r' || e.key === 'R') { const id = voice.last(); if (id && !voice.busy()) voice.speak(id); }
    if (e.key === 'p' || e.key === 'P') { paused = !paused; log(paused ? 'autopilot paused' : 'autopilot on'); if (!paused) check(); }
  }
  addEventListener('keydown', onKey);
  return {
    heard(text) { if (text?.trim()) { heard += ` ${text}`; check(); } },
    stop() { doneAll = true; clearTimeout(timer); removeEventListener('keydown', onKey); },
  };
}
