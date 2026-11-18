// Shared pieces for the video scenes: DOM helpers, deterministic motion, the money formatter, icons and Sherpy.
// Nothing here runs at import time (the player module is also imported by the Node unit tests).

// Same formatter as money() in agent/src/video/facts.mjs. The scene JSON carries raw numbers only
// (scene.values stays on the server), so the browser formats them with this identical copy.
export function money(v) {
  if (Math.abs(v) < 1e6) return '$' + Math.round(v).toLocaleString('en-US');
  const m = Number((v / 1e6).toFixed(2));
  return `$${m} million`;
}

// Shared drawing helpers for the video: DOM builders, easing, icons (fixed SVG), the Sherpy mascot.
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
}
export function html(tag, cls, markup) {
  const e = el(tag, cls);
  e.innerHTML = markup;
  return e;
}

const clamp01 = (p) => Math.min(1, Math.max(0, p));
const easeOut = (p) => 1 - (1 - p) ** 3;

// Every animation is a paused Web Animation (or a tween function) whose time is set from the scene clock,
// so any frame can be shown by seeking. Decorative loops are skipped when motion is reduced.
export function motion(reduced) {
  const anims = [];
  const tweens = [];
  // fill 'both' for entrances (hidden before they start); exits use 'forwards' so they don't override the entrance before they start.
  function play(target, keyframes, { at = 0, dur = 0.45, easing = 'ease-out', iterations = 1, direction = 'normal', fill = 'both' } = {}) {
    const a = target.animate(keyframes, { duration: dur * 1000, delay: at * 1000, fill, easing, iterations, direction });
    a.pause();
    anims.push(a);
    return a;
  }
  return {
    reduced,
    play,
    // Appear: a springy pop, or a plain fade when motion is reduced.
    pop(target, at, { from = 0 } = {}) {
      if (reduced) return play(target, [{ opacity: 0 }, { opacity: 1 }], { at, dur: 0.25 });
      return play(target, [
        { opacity: 0, scale: String(from) },
        { opacity: 1, scale: '1.12', offset: 0.6 },
        { opacity: 1, scale: '1' },
      ], { at, dur: 0.5, easing: 'cubic-bezier(.3,.7,.4,1)' });
    },
    // Disappear (used for Sherpy handing over to the data).
    out(target, at, { x = -900 } = {}) {
      if (reduced) return play(target, [{ opacity: 1 }, { opacity: 0 }], { at, dur: 0.25, fill: 'forwards' });
      return play(target, [{ translate: '0 0' }, { translate: `${x}px 0` }], { at, dur: 0.6, easing: 'cubic-bezier(.6,0,.8,.4)', fill: 'forwards' });
    },
    slideIn(target, at, { x = 700 } = {}) {
      if (reduced) return play(target, [{ opacity: 0 }, { opacity: 1 }], { at, dur: 0.25 });
      return play(target, [{ translate: `${x}px 0` }, { translate: '0 0' }], { at, dur: 0.7, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
    },
    // Decorative: gentle floating, wiggles. Not shown with reduced motion.
    loop(target, keyframes, { at = 0, dur = 2.4 } = {}) {
      if (reduced) return null;
      return play(target, keyframes, { at, dur, easing: 'ease-in-out', iterations: Infinity, direction: 'alternate' });
    },
    bob(target, at, { dy = 8, dur = 1.8 } = {}) {
      return this.loop(target, [{ translate: '0 0' }, { translate: `0 ${-dy}px` }], { at, dur });
    },
    // fn(p) with p eased 0..1 between at and at + dur (counters, growing bars).
    tween(at, dur, fn) { tweens.push({ at, dur, fn }); },
    at(t) {
      for (const a of anims) a.currentTime = t * 1000;
      for (const w of tweens) w.fn(easeOut(clamp01(w.dur > 0 ? (t - w.at) / w.dur : t >= w.at ? 1 : 0)));
    },
    dispose() { for (const a of anims) a.cancel(); anims.length = 0; tweens.length = 0; },
  };
}

// A key segment says `m` when it is exactly `m`, or contains it and `m` is long enough not to hide inside
// another value ("1" must not match "$1.43 million").
const says = (text, m) => { const t = text.trim().toLowerCase(); return t === m || (m.length >= 4 && t.includes(m)); };

// Seconds into the scene at which the narration says `match` (first key segment containing it, at or after
// `after` seconds), a little early so the picture lands with the word. Falls back to `fallback` x duration.
// Always before 85 % of the scene.
export function cue(scene, duration, match, fallback, after = 0) {
  const segs = scene.segments ?? [];
  const total = segs.reduce((s, x) => s + String(x.text ?? '').length, 0);
  const m = String(match ?? '').toLowerCase();
  let acc = 0;
  if (total && m) {
    for (const s of segs) {
      const text = String(s.text ?? '');
      const at = (acc / total) * duration;
      if (s.key && at >= after && says(text, m)) return Math.min(0.85 * duration, Math.max(0, at - 0.25));
      acc += text.length;
    }
  }
  return Math.min(0.85 * duration, Math.max(after, fallback * duration));
}

// Like cue(), but returns when the sentence holding `match` starts (so a row can appear as its sentence begins).
export function sentenceCue(scene, duration, match, fallback, after = 0) {
  const segs = scene.segments ?? [];
  const text = segs.map((x) => String(x.text ?? '')).join('');
  const m = String(match ?? '').toLowerCase();
  let acc = 0;
  if (text.length && m) {
    for (const s of segs) {
      const t = String(s.text ?? '');
      if (s.key && (acc / text.length) * duration >= after && says(t, m)) {
        const before = text.slice(0, acc);
        const end = Math.max(before.search(/[.!?]\s[^.!?]*$/), -1);
        const begin = end < 0 ? 0 : end + 2;
        return Math.min(0.85 * duration, Math.max(after, (begin / text.length) * duration - 0.1));
      }
      acc += t.length;
    }
  }
  return Math.min(0.85 * duration, Math.max(after, fallback * duration));
}

// ---------------------------------------------------------------- icons (drawn by us, flat, navy outlines)

const INK = 'stroke="#0b0f2e" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
const ICONS = {
  cap: `<polygon ${INK} fill="#4666d7" points="50,16 95,36 50,56 5,36"/>
    <path ${INK} fill="#112980" d="M24,45 V66 C24,80 76,80 76,66 V45 L50,56 Z"/>
    <path ${INK} fill="none" d="M84,40 V64"/><circle ${INK} fill="#f7bb61" cx="84" cy="70" r="6"/>`,
  palm: `<circle ${INK} fill="#f7bb61" cx="24" cy="24" r="12"/>
    <path ${INK} fill="#f7bb61" d="M6,90 Q50,70 94,90 Z"/>
    <path ${INK} fill="#8a5f40" d="M52,82 C50,64 52,46 58,32 L65,34 C60,48 58,64 60,82 Z"/>
    <path ${INK} fill="#1dae53" d="M61,32 C50,20 34,20 24,30 C38,28 50,30 61,32 Z"/>
    <path ${INK} fill="#1dae53" d="M61,32 C72,18 88,18 96,30 C82,27 72,28 61,32 Z"/>
    <path ${INK} fill="#168b41" d="M61,32 C56,40 46,48 34,50 C42,40 52,34 61,32 Z"/>
    <path ${INK} fill="#168b41" d="M61,32 C70,38 80,46 84,56 C74,50 66,40 61,32 Z"/>`,
  chair: `<path ${INK} fill="#a4b7fd" d="M30,14 H62 V54 H30 Z"/>
    <path ${INK} fill="none" d="M38,24 V46 M46,24 V46 M54,24 V46"/>
    <path ${INK} fill="#4666d7" d="M24,54 H76 V64 H24 Z"/>
    <path ${INK} fill="none" d="M30,64 L26,84 M72,64 L76,84"/>
    <path ${INK} fill="none" stroke-width="7" d="M12,80 Q50,96 90,80"/>`,
  house: `<path ${INK} fill="#4666d7" d="M16,48 L50,18 L84,48 Z"/>
    <path ${INK} fill="#ffffff" d="M24,46 H76 V88 H24 Z"/>
    <path ${INK} fill="#f7bb61" d="M43,88 V64 H57 V88"/>
    <path ${INK} fill="#a4b7fd" d="M30,54 H40 V64 H30 Z"/>`,
  car: `<path ${INK} fill="#4666d7" d="M10,64 V52 L24,34 H70 L86,52 H92 V64 Z"/>
    <path ${INK} fill="#a4b7fd" d="M30,40 H48 V52 H22 Z M54,40 H68 L78,52 H54 Z"/>
    <circle ${INK} fill="#0b0f2e" cx="30" cy="68" r="10"/><circle ${INK} fill="#0b0f2e" cx="72" cy="68" r="10"/>`,
  shield: `<path ${INK} fill="#4666d7" d="M50,10 L84,22 V48 C84,70 68,84 50,92 C32,84 16,70 16,48 V22 Z"/>
    <path fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" d="M34,50 L46,62 L68,38"/>`,
  umbrella: `<path ${INK} fill="#4666d7" d="M8,52 C10,26 30,12 50,12 C70,12 90,26 92,52 C84,46 76,46 68,52 C62,46 56,46 50,52 C44,46 38,46 32,52 C24,46 16,46 8,52 Z"/>
    <path ${INK} fill="none" stroke-width="6" d="M50,52 V80 C50,90 36,90 36,80"/>`,
  piggy: `<circle ${INK} fill="#f7bb61" cx="56" cy="16" r="9"/>
    <path ${INK} fill="#e8738a" d="M20,58 C20,38 40,28 58,30 C74,32 86,42 86,58 C86,72 74,80 60,80 H40 C28,80 20,70 20,58 Z"/>
    <path ${INK} fill="#e8738a" d="M32,36 L30,22 L44,30 Z"/>
    <path ${INK} fill="#e8738a" d="M10,52 H22 V64 H10 Z"/>
    <path ${INK} fill="none" d="M34,80 V90 M68,80 V90 M48,38 H62"/><circle fill="#0b0f2e" cx="36" cy="50" r="4"/>`,
  card: `<rect ${INK} fill="#4666d7" x="8" y="22" width="84" height="58" rx="10"/>
    <path fill="#0b0f2e" d="M10,34 H90 V46 H10 Z"/><path ${INK} fill="none" d="M20,66 H44"/>`,
  arrow: `<path ${INK} fill="#1dae53" d="M50,10 L86,48 H64 V90 H36 V48 H14 Z"/>`,
  flag: `<path ${INK} fill="none" stroke-width="6" d="M24,92 V10"/>
    <path ${INK} fill="#cd3b3b" d="M24,12 H80 L68,30 L80,48 H24 Z"/>`,
};
export const icon = (name) => `<svg viewBox="0 0 100 100" aria-hidden="true">${ICONS[name] ?? ICONS.arrow}</svg>`;

export const goalIcon = (g) => ({ college: 'cap', vacation: 'palm', retirement: 'chair' })[g.type]
  ?? (g.type === 'purchase' ? (/vehicle|car/i.test(g.label ?? '') ? 'car' : 'house') : 'flag');
export const topicIcon = (topic) => ({ protection: 'shield', college: 'cap', retirement: 'chair', debt: 'card', cash: 'piggy' })[topic] ?? 'flag';
export function moveIcon(title) {
  const t = String(title ?? '').toLowerCase();
  if (/umbrella/.test(t)) return 'umbrella';
  if (/cover|insur|mortal|protect/.test(t)) return 'shield';
  if (/sav/.test(t)) return 'piggy';
  if (/card|debt|revolv/.test(t)) return 'card';
  return 'arrow';
}

// ---------------------------------------------------------------- Sherpy

let sherpyMarkup = null;
let sherpyLoading = null;
function loadSherpy() {
  sherpyLoading ??= fetch('/sherpy.svg')
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`sherpy ${r.status}`))))
    .then((text) => {
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const svg = doc.documentElement;
      svg.querySelectorAll('style').forEach((s) => s.remove()); // its :root vars and .mouth-open rule would leak into the page
      svg.setAttribute('class', 'yak');
      svg.setAttribute('aria-hidden', 'true');
      sherpyMarkup = new XMLSerializer().serializeToString(svg);
    })
    .catch(() => { sherpyLoading = null; });
  return sherpyLoading;
}
export const preloadSherpy = () => loadSherpy();

// A raised arm (suit sleeve + hoof) drawn in the mascot's own coordinates, behind the body.
const ARM = `<svg class="arm" viewBox="20 40 280 336" aria-hidden="true"><g class="arm-rig">
  <path d="M244,300 L292,222" fill="none" stroke="#0b0f2e" stroke-width="34" stroke-linecap="round"/>
  <path d="M244,300 L292,222" fill="none" stroke="var(--brand-700)" stroke-width="22" stroke-linecap="round"/>
  <circle cx="295" cy="212" r="17" fill="#8a5f40" stroke="#0b0f2e" stroke-width="5"/></g></svg>`;

// <div.sherpy> (slide/pop target) > <div.rig> (bob target) > arm + mascot. The mascot markup is filled in
// as soon as it is loaded; the arm exists at once so its wave can be scheduled.
export function sherpy({ arm = false } = {}) {
  const wrap = el('div', 'sherpy');
  const rig = el('div', 'rig');
  if (arm) rig.insertAdjacentHTML('beforeend', ARM);
  const body = el('div', 'body');
  rig.append(body);
  wrap.append(rig);
  const fill = () => { if (sherpyMarkup && !body.firstChild) body.innerHTML = sherpyMarkup; };
  if (sherpyMarkup) fill(); else loadSherpy().then(fill);
  return { wrap, rig, arm: rig.querySelector('.arm-rig') };
}
