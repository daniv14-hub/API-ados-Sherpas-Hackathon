// Player for the personal explainer video. Pure helpers are exported (and unit-tested); startPlayer() wires the page.
import { renderScene } from './video-stage.mjs';
import { estimateDuration } from './video-time.mjs';

export { estimateDuration };

// Words with the time (seconds from the clip start) at which each one is spoken, proportional to characters.
// A segment that continues the previous word without whitespace ("5" + "%.") is glued to it.
export function wordTimes(segments, duration) {
  const words = [];
  let glue = false; // previous segment ended in the middle of a word
  for (const seg of segments ?? []) {
    const text = String(seg.text ?? '');
    const parts = text.split(/\s+/).filter(Boolean);
    parts.forEach((p, i) => {
      if (i === 0 && glue && !/^\s/.test(text) && words.length) {
        const last = words[words.length - 1];
        last.word += p; last.key ||= !!seg.key;
      } else words.push({ word: p, key: !!seg.key, start: 0 });
    });
    if (parts.length) glue = !/\s$/.test(text);
    else if (text.length) glue = false; // whitespace-only segment ends the word
  }
  const total = words.reduce((s, w) => s + w.word.length + 1, 0);
  let acc = 0;
  for (const w of words) { w.start = total ? (acc / total) * duration : 0; acc += w.word.length + 1; }
  return words;
}

// Caption chunks: one sentence each (split after a word ending in . ! ?). A sentence longer than maxChars is
// cut into balanced pieces so a chunk never needs more than two caption lines; a break after a comma, colon
// or semicolon is preferred. Returns [{ first, last, words }] (indices into `words`).
const lengthOf = (ws) => ws.reduce((n, w) => n + w.word.length + 1, 0) - 1;

function balance(ws, maxChars) {
  const pieces = Math.ceil(lengthOf(ws) / maxChars);
  if (pieces <= 1) return [ws];
  const target = lengthOf(ws) / pieces;
  let acc = 0;
  let cut = -1;
  let soft = -1; // last word ending in , ; : past half the target
  for (let i = 0; i < ws.length - 1; i++) {
    acc += ws[i].word.length + 1;
    if (/[,;:]$/.test(ws[i].word) && acc >= target * 0.5) soft = i;
    if (acc >= target) { cut = soft >= 0 && acc - target < target * 0.6 ? soft : i; break; }
  }
  if (cut < 0) return [ws];
  return [ws.slice(0, cut + 1), ...balance(ws.slice(cut + 1), maxChars)];
}

export function captionChunks(words, maxChars = 110) {
  const sentences = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?]["')”]?$/.test(w.word)) { sentences.push(cur); cur = []; }
  }
  if (cur.length) sentences.push(cur);
  const chunks = [];
  let first = 0;
  for (const s of sentences) {
    for (const piece of balance(s, maxChars)) {
      chunks.push({ first, last: first + piece.length - 1, words: piece });
      first += piece.length;
    }
  }
  return chunks;
}

export function timeline(scenes) {
  let start = 0;
  return scenes.map((s) => {
    const duration = s.duration ?? estimateDuration(s.text);
    const slot = { start, duration };
    start += duration;
    return slot;
  });
}

// ---------------------------------------------------------------- page (browser only below here)

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const CLIP_TIMEOUT_MS = 6000;
function clipDuration(url) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => resolve(null);
    setTimeout(() => { a.removeAttribute('src'); resolve(null); }, CLIP_TIMEOUT_MS);
    a.src = url;
  });
}

export async function startPlayer() {
  const params = new URLSearchParams(location.search);
  const caseId = params.get('case') ?? '';
  const jumpTo = params.has('t') ? Math.max(0, Number(params.get('t')) || 0) : null;
  const paused = params.get('paused') === '1';
  const state = (s) => { document.body.dataset.state = s; };

  const stageEl = $('stage');
  const audio = $('clip');
  const fit = $('fit');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const applyMotion = () => document.body.classList.toggle('reduced', reduced.matches);
  applyMotion(); reduced.addEventListener?.('change', applyMotion);

  // Scale the 1280x720 space (stage, captions, overlays) to the room the page leaves for it.
  function resize() {
    const box = $('frame').getBoundingClientRect();
    const k = Math.max(0.01, Math.min(box.width / 1280, box.height / 720));
    fit.style.width = `${1280 * k}px`; fit.style.height = `${720 * k}px`;
    $('scaled').style.transform = `scale(${k})`;
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', resize);
  state('loading'); resize();

  let scenes;
  try {
    const res = await fetch(`/video/${encodeURIComponent(caseId)}`);
    if (res.status === 409) return void showMessage('Finish your conversation with Sherpy first. Your video will be ready right after.');
    if (!res.ok) return void showMessage('We could not put your video together. Please try again in a moment.');
    const video = await res.json();
    // Real clip durations; a clip that will not load plays as "Narration unavailable" on the timer clock.
    scenes = await Promise.all(video.scenes.map(async (s) => {
      const duration = s.audio ? await clipDuration(s.audio) : null;
      return { ...s, audio: duration ? s.audio : null, duration };
    }));
  } catch {
    return void showMessage('We could not put your video together. Please try again in a moment.');
  }
  const tl = timeline(scenes);
  const total = tl.length ? tl.at(-1).start + tl.at(-1).duration : 0;
  const words = scenes.map((s, i) => wordTimes(s.segments, tl[i].duration));
  const chunks = words.map((w) => captionChunks(w));

  const handles = scenes.map(() => null);

  let cur = -1;             // scene on stage
  let playing = false;
  let timerBase = 0;        // performance.now() when the timer clock (no audio) started, minus its offset
  let timerOffset = 0;      // seconds already played on the timer clock when paused
  let ctx = null, analyser = null, lvl = 0;
  const samples = new Float32Array(1024);

  function showScene(i) {
    if (i === cur) return;
    if (cur >= 0) { handles[cur]?.dispose?.(); handles[cur] = null; }
    cur = i;
    stageEl.replaceChildren();
    handles[i] = renderScene(stageEl, scenes[i], { reducedMotion: reduced.matches });
    $('unavailable').hidden = !!scenes[i].audio;
  }
  const sceneTime = () => {
    if (!playing) return timerOffset; // paused / not started: where we are held
    return scenes[cur]?.audio ? audio.currentTime : (performance.now() - timerBase) / 1000;
  };

  // Only the sentence being spoken; its words not yet said are dimmed. Rebuilt only when the chunk changes.
  let capKey = '';
  function captions(i, t) {
    const ws = words[i];
    let n = -1; // last word already spoken
    for (let k = 0; k < ws.length && ws[k].start <= t + 1e-6; k++) n = k;
    const chunk = chunks[i].find((c) => n <= c.last) ?? chunks[i].at(-1);
    const box = $('captions');
    const key = `${i}:${chunk?.first}`;
    if (key !== capKey) {
      capKey = key;
      box.replaceChildren(...(chunk?.words ?? []).map((w) => {
        const el = document.createElement('span');
        el.className = w.key ? 'w key' : 'w';
        el.textContent = w.word;
        return el;
      }));
    }
    [...box.children].forEach((el, k) => el.classList.toggle('later', chunk.first + k > n));
  }

  function draw(i, t) {
    showScene(i);
    handles[i]?.at(clamp(t, 0, tl[i].duration));
    captions(i, t);
    const g = tl[i].start + clamp(t, 0, tl[i].duration);
    $('bar').style.width = `${total ? (g / total) * 100 : 0}%`;
    $('clock').textContent = `${fmt(g)} / ${fmt(total)}`;
  }

  function startScene(i, offset = 0) {
    showScene(i);
    const s = scenes[i];
    timerOffset = offset;
    audio.pause();
    if (s.audio) audio.src = s.audio; else { audio.removeAttribute('src'); audio.load(); }
    if (playing) resume();
  }
  function resume() {
    playing = true;
    ensureAudioGraph();
    timerBase = performance.now() - timerOffset * 1000;
    if (scenes[cur].audio) {
      if (timerOffset > 0) audio.currentTime = timerOffset;
      audio.play().catch((e) => { if (e?.name === 'NotAllowedError') pause(); }); // AbortError: a newer load replaced this play
    }
    state('playing'); setPlayLabel();
  }
  function pause() {
    timerOffset = sceneTime();
    audio.pause();
    playing = false;
    if (document.body.dataset.state === 'playing') state('paused');
    setPlayLabel();
  }
  function advance() {
    if (cur + 1 < scenes.length) startScene(cur + 1);
    else { playing = false; timerOffset = tl[cur].duration; draw(cur, timerOffset); state('ended'); setPlayLabel(); }
  }
  audio.addEventListener('error', () => { // clip failed mid-way: finish the scene on the timer clock
    if (cur < 0 || !scenes[cur].audio) return;
    const t = playing ? audio.currentTime || 0 : timerOffset;
    scenes[cur].audio = null;
    audio.removeAttribute('src'); audio.load();
    $('unavailable').hidden = false;
    timerOffset = t; timerBase = performance.now() - t * 1000;
  });
  audio.addEventListener('ended', () => { if (playing && scenes[cur]?.audio) advance(); });

  function setPlayLabel() { $('toggle').textContent = playing ? 'Pause' : 'Play'; }
  function ensureAudioGraph() {
    if (ctx) return;
    try {
      ctx = new AudioContext();
      analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
      ctx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(ctx.destination);
    } catch { ctx?.close?.().catch(() => {}); ctx = null; analyser = null; }
    ctx?.resume?.();
  }

  function begin(offsetGlobal = 0) {
    ensureAudioGraph(); ctx?.resume?.();
    let i = tl.findIndex((s) => offsetGlobal < s.start + s.duration);
    if (i < 0) i = 0;
    playing = true;
    if (cur >= 0) { handles[cur]?.dispose?.(); handles[cur] = null; }
    cur = -1;
    startScene(i, Math.max(0, offsetGlobal - tl[i].start));
  }

  $('play').addEventListener('click', () => begin(0));
  $('toggle').addEventListener('click', () => { if (document.body.dataset.state === 'ended') begin(0); else if (playing) pause(); else if (cur >= 0) resume(); });
  for (const id of ['replay', 'replay2']) $(id).addEventListener('click', () => begin(0));

  function frame() {
    if (cur >= 0 && scenes.length) {
      let t = sceneTime();
      if (playing && !scenes[cur].audio && t >= tl[cur].duration) { advance(); t = sceneTime(); }
      if (cur >= 0) draw(cur, t);
    }
    let target = 0;
    if (analyser && playing && scenes[cur]?.audio) {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0; for (let k = 0; k < samples.length; k++) sum += samples[k] * samples[k];
      target = Math.min(1, Math.sqrt(sum / samples.length) * 6);
    }
    lvl = lvl * 0.5 + target * 0.5;
    stageEl.style.setProperty('--lvl', lvl.toFixed(3));
    requestAnimationFrame(frame);
  }

  if (!scenes.length) return void showMessage('We could not put your video together. Please try again in a moment.');

  // Show the first frame (or the requested one) before anyone presses play.
  state('ready'); resize();
  const jump = jumpTo === null ? 0 : clamp(jumpTo, 0, total);
  let i = tl.findIndex((s) => jump < s.start + s.duration);
  if (i < 0) i = scenes.length - 1;
  startScene(i, 0);
  playing = false;
  const offset = jump - tl[i].start;
  timerOffset = offset;
  if (paused) { state('paused'); document.body.classList.add('still'); }
  requestAnimationFrame(frame);
  setPlayLabel();
}

function fmt(s) { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
function showMessage(text) {
  document.body.dataset.state = 'message';
  document.getElementById('message-text').textContent = text;
}
