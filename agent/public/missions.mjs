import { scoreFor } from '/game-score.mjs';
import * as L from '/missions-logic.mjs';
import { mountJourneyNav } from '/journey-nav.mjs';
import * as S from '/step-logic.mjs';
import { renderBlocks } from '/step-ui.mjs';
import { mountSherpyChat } from '/sherpy-chat.mjs';

const app = document.getElementById('app');
const status = document.getElementById('status');
const params = new URLSearchParams(location.search);
let caseId = params.get('case');
let data = null;
let single = false;
let state = L.emptyState();
let view = { name: 'overview' };
let storageOk = true;
let chat = null; // the Ask Sherpy bubble

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
  try {
    const raw = JSON.parse(localStorage.getItem(key()));
    return { ...L.sanitizeState(data, raw), answers: S.sanitizeAnswers(data, raw?.answers) };
  } catch { storageOk = false; return { ...L.emptyState(), answers: {} }; }
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

// One level on the path: a big round node (number, ✓ or the next one with Sherpy) and a label card beside it.
const PATH_X = [0, 40, 80, 40]; // zigzag offsets in px, repeating
const ROW_H = 132;
function missionNode(m, status, n, i) {
  const pr = L.missionProgress(m, state);
  const alone = L.aloneScore(data, m, scoreFor);
  const owner = ownerOfMission(m);
  const stateText = status === 'done' ? 'Done' : status === 'next' ? 'Next mission' : null;
  const meta = [m.effort && (L.EFFORT[m.effort] ?? m.effort), owner, `${pr.done}/${pr.total} steps`].filter(Boolean).join(' · ');
  const li = h('li', { class: `lvl ${status}` },
    h('button', { type: 'button', class: 'lvl-btn', onclick: () => goto({ name: 'mission', id: m.id }),
      'aria-label': `Mission ${n}: ${m.title}. ${stateText ?? 'Open'}. ${pr.done} of ${pr.total} steps done.` },
      h('span', { class: 'node', 'aria-hidden': 'true' }, status === 'done' ? '✓' : String(n),
        status === 'next' && h('img', { class: 'here', src: '/sherpy.svg', alt: '' })),
      h('span', { class: 'lbl' },
        stateText && h('span', { class: 'state' }, stateText),
        h('span', { class: 'title' }, m.title),
        h('span', { class: 'meta' }, meta),
        m.moveTitle && alone != null && chip(`Score ${data.base} → ${alone}`, 'score'))));
  li.style.setProperty('--x', `${PATH_X[i % PATH_X.length]}px`);
  return li;
}

// The dotted trail behind the nodes (node centres: x = 34 + offset, y = row middle).
function pathTrail(count) {
  const pts = Array.from({ length: count }, (_, i) => [34 + PATH_X[i % PATH_X.length], ROW_H * i + ROW_H / 2]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += ` C ${x0} ${y0 + ROW_H / 2}, ${x1} ${y1 - ROW_H / 2}, ${x1} ${y1}`;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'trail'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '200'); svg.setAttribute('height', String(ROW_H * count));
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

function factList(facts, { yours = false } = {}) {
  return h('dl', null, facts.map((f) => h('div', { class: 'fact' },
    h('dt', null, f.label, f.yours && [' ', chip('yours', 'yours')]),
    h('dd', null, L.formatFact(f)))));
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
    h('h2', { class: 'section-title' }, 'Your path'),
    h('div', { class: 'path-wrap' }, pathTrail(missions.length), h('ol', { class: 'path' }, missions.map((m, i) => missionNode(m, st[m.id], i + 1, i)))),
  ];
  if (data.keepInView.length) nodes.push(moreAdvice(data.keepInView));
  nodes.push(footer());
  show(nodes);
}

// "More advice from your plan": the plan's other advice as a swipeable deck of cards, full text, a topic each.
const TOPIC_CLASS = { Taxes: 't1', College: 't2', Retirement: 't3', Protection: 't4', Debt: 't5', Cash: 't6', Investing: 't7', Home: 't8', 'Your plan': 't0' };
function moreAdvice(items) {
  const deck = h('div', { class: 'deck', tabindex: '0', role: 'region', 'aria-label': 'More advice from your plan, swipe to read' },
    items.map((k, i) => {
      const c = L.adviceCard(k);
      return h('article', { class: `tip ${TOPIC_CLASS[c.topic] ?? 't0'}`, 'aria-label': `${i + 1} of ${items.length}` },
        h('div', { class: 'tip-top' }, h('span', { class: 'topic' }, c.topic), h('span', { class: 'count' }, `${i + 1} / ${items.length}`)),
        c.headline && h('h3', null, c.headline),
        h('p', null, c.text),
        k.facts?.length ? factList(k.facts) : null,
        h('button', { type: 'button', class: 'pill small', onclick: () => chat?.open() }, 'Ask Sherpy about this'));
    }));
  const step = (dir) => deck.scrollBy({ left: dir * deck.clientWidth * 0.86, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return h('section', { class: 'more', 'aria-labelledby': 'more-title' },
    h('div', { class: 'more-head' },
      h('div', null, h('h2', { class: 'section-title', id: 'more-title' }, 'More advice from your plan'),
        h('p', { class: 'fine' }, `${items.length} tips · nothing to do now · swipe to read`)),
      h('div', { class: 'deck-nav' },
        h('button', { type: 'button', class: 'mv', 'aria-label': 'Previous tip', onclick: () => step(-1) }, '‹'),
        h('button', { type: 'button', class: 'mv', 'aria-label': 'Next tip', onclick: () => step(1) }, '›'))),
    deck);
}

function footer() {
  return h('footer', { class: 'footer' },
    h('small', null, "You tell us when it's done. Nothing is checked for you. What you type stays in this browser. ", h('a', { href: '/privacy.html' }, 'Privacy')),
    !storageOk && h('small', null, "This browser can't save your progress, so it will reset when you close the page."),
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

function setAnswer(stepId, i, who, value) {
  const answers = { ...(state.answers ?? {}) };
  const st = { ...(answers[stepId] ?? {}) };
  st[i] = { ...(st[i] ?? {}), [who]: value };
  answers[stepId] = st;
  state = { ...state, answers };
  save();
}

// Redraw the mission after a click inside a step, keeping the scroll position and the focused control.
function redrawMission(id) {
  const a = document.activeElement;
  const label = a?.getAttribute?.('aria-label');
  const fid = a?.id;
  renderMission(id, { keepScroll: window.scrollY, focusStep: null });
  const again = (fid && document.getElementById(fid)) || (label && app.querySelector(`[aria-label="${CSS.escape(label)}"]`));
  if (again && !again.disabled) again.focus({ preventScroll: true });
}

// Which steps are unfolded: the current one, plus any the family opened; a step they folded stays folded.
let fold = { mission: null, open: new Set(), closed: new Set() };
const currentStepId = (m) => m.steps.find((s) => !state.done[s.id])?.id ?? null;
function isOpen(m, id) {
  if (fold.mission !== m.id) fold = { mission: m.id, open: new Set(), closed: new Set() };
  return fold.open.has(id) || (id === currentStepId(m) && !fold.closed.has(id));
}
function toggleFold(m, id) {
  if (isOpen(m, id)) { fold.open.delete(id); fold.closed.add(id); } else { fold.closed.delete(id); fold.open.add(id); }
  redrawMission(m.id);
}

function stepCard(m, step, idx, whyStepId) {
  const open = isOpen(m, step.id);
  const done = !!state.done[step.id];
  const unlocked = L.stepUnlocked(m, state, step.id);
  const locked = !done && !unlocked;
  const owner = L.ownerLabel(step.owner, single);
  const isLearn = step.type === 'learn';
  const label = done ? 'Done. Tap to undo' : isLearn ? "I've read it" : 'I did it';
  const people = S.peopleOf(data.label);
  const hint = h('span', { class: 'fine need', role: 'status' });
  const isReady = () => S.stepReady(step, state.answers, people);
  const btn = h('button', { type: 'button', class: `pill ${done ? '' : 'primary'}`, 'aria-pressed': String(done), 'aria-disabled': locked ? 'true' : 'false',
    onclick: () => {
      if (locked) return;
      if (!done && !isReady()) { hint.textContent = 'Fill in this step first.'; return; }
      const r = L.toggleStep(data, state, m.id, step.id);
      const before = L.progress(data, state).done;
      state = r.state; save();
      fold.open.delete(step.id); fold.closed.delete(step.id);
      if (r.completedNow) { announce('Checkpoint reached'); goto({ name: 'checkpoint', id: m.id, fromDone: before }); }
      else {
        announce(done ? 'Step undone' : 'Step done');
        const y = window.scrollY;
        const nextId = currentStepId(m);
        renderMission(m.id, { keepScroll: y, focusStep: nextId ?? step.id });
        if (nextId && !done) document.getElementById(`s-${nextId}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    } }, done ? '✓ Done (undo)' : label);
  const refresh = () => {
    if (done || locked) return;
    const ok = isReady();
    btn.classList.toggle('waiting', !ok);
    if (ok) hint.textContent = '';
  };
  refresh();
  const blocks = !locked && step.ui ? renderBlocks({
    h, data, mission: m, step, people,
    get answers() { return state.answers; }, // always the latest answers, never a copy from render time
    set: (i, who, value) => setAnswer(step.id, i, who, value),
    redraw: () => redrawMission(m.id),
    ready: () => { refresh(); },
    copy: (text, note) => copyText(text, note).catch(() => note('Select the text above and copy it')),
    openSherpy: () => chat?.open(),
  }) : (!locked && isLearn ? renderBlocks({ h, data, mission: m, step: { ...step, ui: [] }, answers: {}, people, openSherpy: () => chat?.open() }) : []);
  const typeName = L.STEP_TYPES[step.type] ?? step.type;
  const head = h('button', { type: 'button', class: 'shead', 'aria-expanded': String(open), 'aria-controls': `sb-${step.id}`, onclick: () => toggleFold(m, step.id) },
    h('span', { class: 'stitle' }, step.title),
    h('span', { class: 'chips' }, chip(typeName, `type t-${step.type}`), owner && chip(owner, 'owner'), done && chip('Done', 'done'), locked && chip('Locked', 'lockedchip')),
    h('span', { class: 'chev', 'aria-hidden': 'true' }, open ? '▴' : '▾'));
  if (!open) {
    return h('div', { class: `sticker step folded ${done ? 'done' : ''} ${locked ? 'locked' : ''}`, id: `s-${step.id}` },
      h('span', { class: 'num', 'aria-hidden': 'true' }, done ? '✓' : String(idx + 1)),
      h('div', { class: 'main' }, h('h3', { class: 'shwrap' }, head)));
  }
  return h('div', { class: `sticker step ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${step.id === currentStepId(m) ? 'current' : ''}`, id: `s-${step.id}` },
    h('span', { class: 'num', 'aria-hidden': 'true' }, done ? '✓' : String(idx + 1)),
    h('div', { class: 'main', id: `sb-${step.id}` },
      h('h3', { class: 'shwrap' }, head),
      step.body && h('p', { class: `sbody ${step.id === whyStepId ? 'why-text' : ''}` }, step.id === whyStepId && h('b', null, 'Why this matters: '), step.body),
      blocks,
      step.kit && !locked && kitBlock(step),
      h('div', { class: 'actions' }, btn, locked ? h('span', { class: 'fine' }, 'Finish the step above first.') : hint)));
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
    m.facts.length ? h('details', { class: 'sticker facts' }, h('summary', null, h('span', null, 'Your plan\'s figures'), chip(String(m.facts.length), 'count')), factList(m.facts)) : null,
    h('h2', { class: 'section-title' }, 'Steps'),
  ];
  const rail = h('div', { class: 'steps' });
  m.steps.forEach((s, i) => rail.append(stepCard(m, s, i, why?.id)));
  nodes.push(rail);
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
  document.body.dataset.view = view.name; // the ‹ Video arrow shows on the missions map only
  chat?.screenChanged();
  if (view.name === 'mission') return renderMission(view.id);
  if (view.name === 'checkpoint') return renderCheckpoint(view);
  return renderOverview();
}

// ---------- boot ----------
function failure(text) {
  show([header(), h('section', { class: 'sticker state-msg' }, h('p', null, text),
    h('p', { style: 'margin-top:14px' }, h('button', { type: 'button', class: 'pill primary', onclick: () => location.reload() }, 'Try again')))], { focus: false });
}

async function boot() {
  try {
    if (!caseId) {
      const cfg = await (await fetch('/config')).json();
      caseId = cfg.cases?.[0]?.id ?? null;
    }
    if (!caseId) return failure('Pick a plan first.');
    // ‹ Video arrow (bottom left) and the Sherpy bubble (bottom right) stay on every missions view.
    const dock = h('div', { class: 'dock' });
    document.body.append(dock);
    mountJourneyNav({ step: 'missions', caseId, parent: dock, look: 'sticker' });
    chat = mountSherpyChat({ caseId, getScreen: () => ({ view: view.name, mission: view.id ?? null, done: Object.keys(state.done ?? {}) }) });
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
