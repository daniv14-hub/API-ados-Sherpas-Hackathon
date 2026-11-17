// Player for the personal explainer video. Pure helpers are exported (and unit-tested); startPlayer() wires the page.
import { renderScene } from './video-stage.mjs';

const CHARS_PER_SECOND = 14;
export const estimateDuration = (text) => String(text ?? '').length / CHARS_PER_SECOND;

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
  }
  const total = words.reduce((s, w) => s + w.word.length + 1, 0);
  let acc = 0;
  for (const w of words) { w.start = total ? (acc / total) * duration : 0; acc += w.word.length + 1; }
  return words;
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

function clipDuration(url) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => resolve(null);
    a.src = url;
  });
}

export async function startPlayer() {
  const params = new URLSearchParams(location.search);
  const caseId = params.get('case') ?? '';
  const jumpTo = params.has('t') ? Math.max(0, Number(params.get('t')) || 0) : null;
  const paused = params.get('paused') === '1';
  const state = (s) => { document.body.dataset.state = s; };

  state('loading');
  let video;
  try {
    const res = await fetch(`/video/${encodeURIComponent(caseId)}`);
    if (res.status === 409) return void showMessage('Your plan conversation is not finished yet. Talk with Sherpy first and your video will be ready right after.');
    if (!res.ok) return void showMessage('We could not put your video together. Please try again in a moment.');
    video = await res.json();
  } catch {
    return void showMessage('We could not reach the server. Please try again in a moment.');
  }

  // Real clip durations; a clip that will not load plays as "Narration unavailable" on the timer clock.
  const scenes = await Promise.all(video.scenes.map(async (s) => {
    const duration = s.audio ? await clipDuration(s.audio) : null;
    return { ...s, audio: duration ? s.audio : null, duration };
  }));
  const tl = timeline(scenes);
  const total = tl.length ? tl.at(-1).start + tl.at(-1).duration : 0;
  const words = scenes.map((s, i) => wordTimes(s.segments, tl[i].duration));

  const stageEl = $('stage');
  const handles = scenes.map(() => null);
  const audio = $('clip');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const applyMotion = () => document.body.classList.toggle('reduced', reduced.matches);
  applyMotion(); reduced.addEventListener?.('change', applyMotion);

  let cur = -1;             // scene on stage
  let playing = false;
  let timerBase = 0;        // performance.now() when the timer clock (no audio) started, minus its offset
  let timerOffset = 0;      // seconds already played on the timer clock when paused
  let ctx = null, analyser = null, lvl = 0;
  const samples = new Float32Array(1024);

  function showScene(i) {
    if (i === cur) return;
    cur = i;
    stageEl.replaceChildren();
    handles[i] = renderScene(stageEl, scenes[i]);
    $('unavailable').hidden = !!scenes[i].audio;
  }
  const sceneTime = () => {
    if (!playing) return timerOffset; // paused / not started: where we are held
    return scenes[cur]?.audio ? audio.currentTime : (performance.now() - timerBase) / 1000;
  };

  function captions(i, t) {
    const shown = words[i].filter((w) => w.start <= t + 1e-6).slice(-16);
    const box = $('captions');
    box.replaceChildren(...shown.map((w) => {
      const el = document.createElement('span');
      el.className = w.key ? 'w key' : 'w';
      el.textContent = w.word;
      return el;
    }));
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
    if (s.audio) audio.src = s.audio; else audio.removeAttribute('src');
    if (playing) resume();
  }
  function resume() {
    playing = true;
    timerBase = performance.now() - timerOffset * 1000;
    if (scenes[cur].audio) {
      if (timerOffset > 0) audio.currentTime = timerOffset;
      audio.play().catch(() => pause());
    }
    state('playing'); setPlayLabel();
  }
  function pause() {
    timerOffset = sceneTime();
    if (scenes[cur]?.audio) audio.pause();
    playing = false;
    if (document.body.dataset.state === 'playing') state('paused');
    setPlayLabel();
  }
  function advance() {
    if (cur + 1 < scenes.length) startScene(cur + 1);
    else { playing = false; timerOffset = tl[cur].duration; draw(cur, timerOffset); state('ended'); setPlayLabel(); }
  }
  audio.addEventListener('ended', () => { if (playing && scenes[cur]?.audio) advance(); });

  function setPlayLabel() { $('toggle').textContent = playing ? 'Pause' : 'Play'; }
  function ensureAudioGraph() {
    if (ctx) return;
    try {
      ctx = new AudioContext();
      analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
      ctx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(ctx.destination);
    } catch { ctx = null; analyser = null; }
    ctx?.resume?.();
  }

  function begin(offsetGlobal = 0) {
    ensureAudioGraph(); ctx?.resume?.();
    let i = tl.findIndex((s) => offsetGlobal < s.start + s.duration);
    if (i < 0) i = 0;
    playing = true;
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

  // Scale the 1280x720 box to the space the page leaves for it.
  const fit = $('fit');
  function resize() {
    const box = $('frame').getBoundingClientRect();
    const s = Math.min(box.width / 1280, box.height / 720);
    fit.style.width = `${1280 * s}px`; fit.style.height = `${720 * s}px`;
    stageEl.style.transform = `scale(${s})`;
  }
  addEventListener('resize', resize);

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
