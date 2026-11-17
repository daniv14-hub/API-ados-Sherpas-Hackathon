import { scoreFor } from '/game-score.mjs';
import * as L from '/missions-logic.mjs';

const app = document.getElementById('app');
const status = document.getElementById('status');
const params = new URLSearchParams(location.search);
let caseId = params.get('case');
let data = null;
let single = false;
let state = L.emptyState();
let view = { name: 'overview' };
let storageOk = true;

// ---------- tiny DOM helper (text only, never innerHTML with data) ----------
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return e;
}
const chip = (text, cls = '') => h('span', { class: `chip ${cls}` }, text);

// ---------- storage ----------
const key = () => `sherpas.missions.v1.${caseId}`;
function load() {
  try { return L.sanitizeState(data, JSON.parse(localStorage.getItem(key()))); } catch { storageOk = false; return L.emptyState(); }
}
function save() { try { localStorage.setItem(key(), JSON.stringify(state)); } catch { storageOk = false; } }

// ---------- rendering ----------
function show(nodes, { focus = true } = {}) {
  app.replaceChildren(...nodes.filter((n) => n instanceof Node));
  if (focus) {
    window.scrollTo(0, 0);
    const t = app.querySelector('[data-focus]');
    if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
}
// Views live in the URL hash and in history, so the phone Back button returns to the list and deep links work.
// history.state.depth = how many in-page entries sit above the overview entry we started from.
function goto(v, { replace = false } = {}) {
  const depth = history.state?.depth ?? 0;
  if (v.name === 'overview' && !replace) {
    if (depth > 0) return history.go(-depth); // popstate renders the overview
    replace = true;
  }
  const url = location.pathname + location.search + L.viewHash(v);
  if (replace) history.replaceState({ depth }, '', url);
  else history.pushState({ depth: depth + 1 }, '', url);
  view = v; render();
}
function viewFromUrl() {
  const v = L.resolveView(data, state, L.parseViewHash(location.hash));
  if (L.viewHash(v) !== location.hash.replace(/^#$/, '')) history.replaceState({ depth: history.state?.depth ?? 0 }, '', location.pathname + location.search + L.viewHash(v));
  return v;
}
addEventListener('popstate', () => { if (data) { view = viewFromUrl(); render(); } });

// One short polite message for screen readers (the page itself is not a live region).
function announce(text) {
  status.textContent = '';
  setTimeout(() => { status.textContent = text; }, 60);
}

function header() {
  return h('header', { class: 'top' },
    h('img', { src: '/sherpas-logo.svg', alt: 'Sherpas' }),
    h('span', { class: 'who' }, data ? data.label : ''));
}

function sherpyRow(text, label = 'Sherpy says') {
  return h('div', { class: 'sherpy-row' },
    h('img', { src: '/sherpy.svg', alt: '' }),
    h('p', { class: 'bubble', 'aria-label': label }, text));
}

function scoreChip() {
  const v = L.scoreView(data, state, scoreFor);
  return v.exact ? chip(`Plan score ${v.score}`, 'score') : chip(`Plan score ${v.score} · last checkpoint`, 'score stale');
}

function progressCard(fromDone = null) {
  const p = L.progress(data, state);
  const fill = h('i', { 'data-zero': p.done === 0 ? '1' : '0' });
  const pct = (n) => (p.total ? Math.round((n / p.total) * 100) : 0);
  fill.style.width = `${pct(fromDone ?? p.done)}%`;
  if (fromDone !== null) requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${pct(p.done)}%`; fill.dataset.zero = p.done === 0 ? '1' : '0'; }));
  return h('section', { class: 'sticker progress', 'aria-label': 'Your progress' },
    h('div', { class: 'row' }, h('span', { class: 'label' }, `${p.done} of ${p.total} steps done`), scoreChip()),
    h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': p.total, 'aria-valuenow': p.done, 'aria-label': 'Steps done' }, fill));
}

function ownerOfMission(m) {
  if (single) return 'You';
  return m.kind === 'joint' ? 'Together' : m.kind === 'individual' ? 'Each of you' : null;
}

function greeting(next) {
  const p = L.progress(data, state);
  if (!next) return 'Every mission is done. Your plan is no longer a document: it is in motion. Well done.';
  if (p.done === 0) return `Hi, I'm Sherpy. Your plan is now a short list of small missions. Start with "${next.title}".`;
  return `${p.done} of ${p.total} steps done. Next up: "${next.title}". One step at a time.`;
}

function missionCard(m, status, n) {
  const pr = L.missionProgress(m, state);
  const alone = L.aloneScore(data, m, scoreFor);
  const owner = ownerOfMission(m);
  const stateText = status === 'done' ? 'Done' : status === 'next' ? 'Next mission' : null;
  const score = m.moveTitle && alone != null
    ? chip(`On its own: score ${data.base} to ${alone}`, 'score')
    : null;
  return h('li', null, h('button', { class: `sticker card ${status}`, type: 'button', onclick: () => goto({ name: 'mission', id: m.id }),
      'aria-label': `${m.title}. ${stateText ?? 'Open'}. ${pr.done} of ${pr.total} steps done.` },
    h('div', { class: 'head' },
      h('span', { class: 'badge', 'aria-hidden': 'true' }, status === 'done' ? '✓' : String(n)),
      h('div', null,
        stateText && h('div', { class: 'state' }, stateText),
        h('div', { class: 'title' }, m.title))),
    h('div', { class: 'chips meta' },
      m.effort && chip(L.EFFORT[m.effort] ?? m.effort, 'effort'),
      owner && chip(owner, 'owner'),
      chip(`${pr.done}/${pr.total} steps`, pr.complete ? 'done' : ''),
      score),
    !score && m.scoreNote && h('p', { class: 'noscore' }, h('b', null, 'No score for this one. '), m.scoreNote)));
}

function factList(facts, { yours = false } = {}) {
  return h('dl', null, facts.map((f) => h('div', { class: 'fact' },
    h('dt', null, f.label, f.yours && [' ', chip('yours', 'yours')]),
    h('dd', null, L.formatFact(f)))));
}

// Derived titles are the first 80 characters of the advice text: tidy a cut-off ending.
function keepTitle(k) {
  const cut = k.body.startsWith(k.title) && k.body.length > k.title.length && !/[.!?]$/.test(k.title);
  return cut ? k.title.replace(/[,;:\s]+\S{0,2}$/, '') + '\u2026' : k.title;
}

function renderOverview() {
  const next = L.nextMission(data, state);
  const st = L.missionStatuses(data, state);
  const missions = L.orderedMissions(data);
  const nodes = [
    header(),
    h('h1', { class: 'sr', 'data-focus': '' }, 'Your missions'),
    sherpyRow(greeting(next)),
    progressCard(),
    h('h2', { class: 'section-title' }, 'Your missions'),
    h('ol', { class: 'list' }, missions.map((m, i) => missionCard(m, st[m.id], i + 1))),
  ];
  if (data.keepInView.length) {
    nodes.push(
      h('h2', { class: 'section-title' }, 'Keep in view'),
      h('p', { class: 'fine', style: 'margin-bottom:10px' }, 'Nothing to do now. Just good to know.'),
      h('div', { class: 'keep' }, data.keepInView.map((k) => h('details', null,
        h('summary', null, keepTitle(k)),
        h('div', { class: 'body' }, h('p', null, k.body), k.facts?.length ? factList(k.facts) : null)))));
  }
  nodes.push(footer());
  show(nodes);
}

function footer() {
  return h('footer', { class: 'footer' },
    h('small', null, "You tell us when it's done. Nothing is checked for you."),
    !storageOk && h('small', null, "This browser can't save your progress, so it will reset when you close the page."),
    h('a', { class: 'pill', href: `/video.html?case=${encodeURIComponent(caseId)}` }, 'Back to my video'),
    resetControl());
}

// In-page confirm instead of the native confirm() dialog.
function resetControl() {
  const wrap = h('div', { class: 'reset' });
  const trigger = h('button', { type: 'button', class: 'linkbtn danger', onclick: () => {
    trigger.hidden = true; box.hidden = false; cancel.focus();
  } }, 'Reset progress');
  const cancel = h('button', { type: 'button', class: 'pill', onclick: () => {
    box.hidden = true; trigger.hidden = false; trigger.focus();
  } }, 'Cancel');
  const box = h('div', { class: 'sticker reset-confirm', role: 'group', 'aria-labelledby': 'reset-q', hidden: true },
    h('p', { id: 'reset-q' }, 'Reset your progress? This clears the steps you marked on this device.'),
    h('div', { class: 'reset-btns' },
      h('button', { type: 'button', class: 'pill danger', onclick: () => {
        state = L.emptyState(); save(); announce('Progress reset'); goto({ name: 'overview' });
      } }, 'Reset'),
      cancel));
  wrap.append(trigger, box);
  return wrap;
}

// ---------- mission detail ----------
async function copyText(text, note) {
  try {
    await navigator.clipboard.writeText(text);
    return note('Copied');
  } catch { /* fall through to the select fallback */ }
  const ta = h('textarea', { 'aria-hidden': 'true', readonly: true });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  note(ok ? 'Copied' : 'Select the text above and copy it');
}

function kitBlock(step) {
  const note = h('span', { class: 'copied', role: 'status' });
  const pre = h('pre', { tabindex: '0' }, step.kit);
  return h('details', { class: 'kit' },
    h('summary', null, 'Kit: help for this step'),
    h('div', { class: 'kit-body' }, pre,
      h('button', { type: 'button', class: 'pill', 'aria-label': `Copy the kit for ${step.title}`, onclick: () => {
        copyText(step.kit, (msg) => { note.textContent = msg; }).catch(() => { note.textContent = 'Select the text above and copy it'; });
      } }, 'Copy'),
      ' ', note));
}

function stepCard(m, step, idx, whyStepId) {
  const done = !!state.done[step.id];
  const unlocked = L.stepUnlocked(m, state, step.id);
  const locked = !done && !unlocked;
  const owner = L.ownerLabel(step.owner, single);
  const isLearn = step.type === 'learn';
  const label = done ? 'Done. Tap to undo' : isLearn ? "I've read it" : 'I did it';
  const btn = h('button', { type: 'button', class: `pill ${done ? '' : 'primary'}`, 'aria-pressed': String(done), 'aria-disabled': locked ? 'true' : 'false',
    onclick: () => {
      if (locked) return;
      const r = L.toggleStep(data, state, m.id, step.id);
      const before = L.progress(data, state).done;
      state = r.state; save();
      if (r.completedNow) { announce('Checkpoint reached'); goto({ name: 'checkpoint', id: m.id, fromDone: before }); }
      else {
        announce(done ? 'Step undone' : 'Step done'); const y = window.scrollY; renderMission(m.id, { keepScroll: y, focusStep: step.id }); }
    } }, done ? '✓ Done (undo)' : label);
  return h('div', { class: `sticker step ${done ? 'done' : ''} ${locked ? 'locked' : ''}`, id: `s-${step.id}` },
    h('span', { class: 'num', 'aria-hidden': 'true' }, done ? '✓' : String(idx + 1)),
    h('div', { class: 'main' },
      h('h3', { class: 'stitle' }, step.title),
      owner && h('div', { class: 'chips' }, chip(owner, 'owner')),
      step.id !== whyStepId && step.body && h('p', { class: 'sbody' }, step.body),
      step.kit && !locked && kitBlock(step),
      h('div', { class: 'actions' }, btn, locked && h('span', { class: 'fine' }, 'Finish the step above first.'))));
}

function renderMission(id, { keepScroll = null, focusStep = null } = {}) {
  const m = data.missions.find((x) => x.id === id);
  if (!m) return goto({ name: 'overview' }, { replace: true });
  const pr = L.missionProgress(m, state);
  const why = m.steps.find((s) => s.type === 'learn') ?? null;
  const owner = ownerOfMission(m);
  const alone = L.aloneScore(data, m, scoreFor);
  const nodes = [
    header(),
    h('button', { type: 'button', class: 'linkbtn back', onclick: () => goto({ name: 'overview' }) }, '← All missions'),
    h('h1', { 'data-focus': '' }, m.title),
    h('div', { class: 'chips', style: 'margin-top:10px' },
      m.effort && chip(L.EFFORT[m.effort] ?? m.effort, 'effort'),
      owner && chip(owner, 'owner'),
      chip(`${pr.done}/${pr.total} steps`, pr.complete ? 'done' : ''),
      m.moveTitle && alone != null ? chip(`On its own: score ${data.base} to ${alone}`, 'score') : null),
    !m.moveTitle && m.scoreNote && h('p', { class: 'fine', style: 'margin-top:8px' }, h('b', null, 'No score for this one. '), m.scoreNote),
    why && h('section', { class: 'sticker why' }, h('h2', null, 'Why this matters'), h('p', null, why.body)),
    m.facts.length ? h('section', { class: 'sticker facts', 'aria-label': 'Facts from your plan' }, h('h2', null, 'From your plan'), factList(m.facts)) : null,
  ];
  let lastType = null;
  m.steps.forEach((s, i) => {
    if (s.type !== lastType) {
      nodes.push(h('div', { class: 'type-head' }, L.STEP_TYPES[s.type] ?? s.type));
      lastType = s.type;
    }
    nodes.push(stepCard(m, s, i, why?.id));
  });
  nodes.push(footer());
  show(nodes, { focus: keepScroll === null });
  if (keepScroll !== null) {
    window.scrollTo(0, keepScroll);
    const b = app.querySelector(`#s-${CSS.escape(focusStep)} button.pill[aria-pressed]`);
    if (b) b.focus({ preventScroll: true });
  }
}

// ---------- checkpoint ----------
function renderCheckpoint(v) {
  const c = L.checkpoint(data, state, v.id, scoreFor);
  const confetti = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const colors = ['var(--brand-400)', 'var(--priority-medium)', 'var(--success)', 'var(--chart-7)', 'var(--chart-6)'];
  for (let i = 0; i < 16; i++) {
    const p = h('i');
    p.style.left = `${(i * 6.4 + 3) % 98}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${(i % 6) * 0.12}s`;
    confetti.append(p);
  }
  const scoreLine = c.fact && /^Your score/.test(c.fact);
  const next = c.nextId ? data.missions.find((m) => m.id === c.nextId) : null;
  show([
    header(),
    h('section', { class: 'sticker cp' }, confetti,
      h('div', { class: 'stage' }, h('img', { src: '/sherpy.svg', alt: 'Sherpy celebrating' }), h('h1', { 'data-focus': '' }, 'Checkpoint reached'),
        h('div', { class: 'says' }, h('div', { class: 'bubble' },
          h('p', null, c.title + '.'),
          c.fact && h('p', { class: scoreLine ? 'score-line' : '' }, c.fact),
          h('p', null, c.nextLine))))),
    h('div', { style: 'height:16px' }),
    progressCard(v.fromDone),
    h('div', { class: 'btns' },
      next && h('button', { type: 'button', class: 'pill primary', onclick: () => goto({ name: 'mission', id: next.id }) }, `Start: ${next.title}`),
      h('button', { type: 'button', class: 'pill', onclick: () => goto({ name: 'overview' }) }, 'See all missions')),
    footer(),
  ]);
}

function render() {
  if (!data) return;
  if (view.name === 'mission') return renderMission(view.id);
  if (view.name === 'checkpoint') return renderCheckpoint(view);
  return renderOverview();
}

// ---------- boot ----------
function failure(text) {
  show([header(), h('section', { class: 'sticker state-msg' }, h('p', null, text),
    h('p', { style: 'margin-top:14px' }, h('button', { type: 'button', class: 'pill primary', onclick: () => location.reload() }, 'Try again'))),
    caseId ? h('div', { class: 'footer' }, h('a', { class: 'pill', href: `/video.html?case=${encodeURIComponent(caseId)}` }, 'Back to my video')) : null], { focus: false });
}

async function boot() {
  try {
    if (!caseId) {
      const cfg = await (await fetch('/config')).json();
      caseId = cfg.cases?.[0]?.id ?? null;
    }
    if (!caseId) return failure('Pick a plan first.');
    const res = await fetch(`/missions/${encodeURIComponent(caseId)}`);
    if (!res.ok) return failure(res.status === 404 ? 'We could not find that plan.' : 'We could not load your missions. Please try again in a moment.');
    data = await res.json();
    single = L.isSingle(data.label);
    state = load();
    view = viewFromUrl();
    render();
  } catch {
    failure('We could not load your missions. Please try again in a moment.');
  }
}
boot();
