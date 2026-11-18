// "Talk to Sherpy" bubble for the missions screens (map and every mission), bottom right (team, 18/11).
// Tap it and it opens into a small voice panel: same voice client as the conversation screen. With a complete
// profile the server starts Sherpy as the plan advisor (phase 2), so answers come only from the family's data.
// Voice is billed while the session is open: closing the panel, leaving the page or a long quiet moment hangs up.
import { createVoiceClient } from '/voice-client.mjs';
import { demoFamilyOn, loadManifest, createFamilyVoice, createAutopilot } from '/demo-family.mjs';
import { tokenize, wordTimes, revealedCount, currentSentence, turnPhase, PHASE_LABEL, classifyError } from '/conversation-logic.mjs';

// Voice is billed while the session is open: after 90 s with nobody talking, the bubble hangs up.
const IDLE_HANGUP_MS = 90_000; // nobody spoke and Sherpy is quiet for this long -> hang up
// Demo mode (demo-family.mjs): after Sherpy's greeting, Emily asks one recorded question about the open mission.
const DEMO = demoFamilyOn();
const demoLines = DEMO ? loadManifest().catch(() => null) : null;
const askOnce = () => { let asked = false; return { reply: () => (asked ? null : (asked = true, 'ask-mission')) }; };

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.filter((k) => k != null));
  return e;
}

// getScreen(): { view, mission, done } of the missions screen on show, so Sherpy knows what "this mission" means.
export function mountSherpyChat({ caseId, parent = document.body, getScreen = () => null }) {
  let autopilot = null, familyLine = null;
  let client = null, raf = 0, lastActivity = 0, lastReplyLen = -1, lastReplyId = 0, lastScreen = 'null';

  const fab = el('button', { type: 'button', class: 'schat-fab', 'aria-label': 'Talk to Sherpy', 'aria-expanded': 'false', 'aria-controls': 'schat-panel' },
    el('img', { src: '/sherpy.svg', alt: '' }),
    el('span', { class: 'schat-fab-label' }, 'Ask Sherpy'));

  const avatar = el('img', { src: '/sherpy.svg', alt: '', class: 'schat-avatar' });
  const caption = el('p', { class: 'schat-caption', 'aria-live': 'polite' });
  const turnLabel = el('span', { class: 'schat-turn-label' }, PHASE_LABEL.connecting);
  const turn = el('div', { class: 'schat-turn', role: 'status' }, el('span', { class: 'schat-dot', 'aria-hidden': 'true' }), turnLabel);
  const errBox = el('div', { class: 'schat-error', hidden: true });
  const close = el('button', { type: 'button', class: 'schat-close', 'aria-label': 'End the call and close' }, '×');
  const panel = el('section', { id: 'schat-panel', class: 'schat-panel', role: 'dialog', 'aria-labelledby': 'schat-title', hidden: true },
    el('header', { class: 'schat-head' }, el('h2', { id: 'schat-title' }, 'Sherpy'), close),
    el('div', { class: 'schat-body' }, avatar, caption, turn, errBox),
    el('p', { class: 'schat-fine' }, 'Ask anything about your plan, out loud. No audio is recorded.'));

  const root = el('div', { class: 'schat' }, panel, fab);
  parent.append(root);

  function setTurn(text) { if (turnLabel.textContent !== text) turnLabel.textContent = text; }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!client) return;
    const s = client.snapshot();
    const phase = turnPhase({ connected: s.connected && !!s.reply, speaking: s.speaking, muted: s.muted, thinking: s.thinking, done: false });
    panel.classList.toggle('talking', phase === 'sherpy');
    panel.classList.toggle('listening', phase === 'user');
    setTurn(PHASE_LABEL[phase]);
    const r = s.reply;
    const now = performance.now();
    if (s.speaking || s.thinking || (r && (r.id !== lastReplyId || r.text.length !== lastReplyLen))) lastActivity = now;
    if (r) { lastReplyId = r.id; lastReplyLen = r.text.length; }
    if (now - lastActivity > IDLE_HANGUP_MS) {
      hangUp();
      showError({ title: 'Sherpy hung up after a quiet moment', retry: 'Talk again' });
      return;
    }
    if (!r || familyLine) return; // the family line stays on screen while it plays
    const complete = r.audioDone || /\s$/.test(r.text) ? r.text : r.text.replace(/\S+$/, '');
    const tokens = tokenize(complete);
    if (!tokens.length) return;
    const times = wordTimes(tokens, { duration: r.audioDone ? r.seconds : null });
    const shown = revealedCount(times, r.startAt ? s.now - r.startAt : -1, 0);
    if (!shown) return;
    const idx = currentSentence(tokens, shown);
    const text = tokens.filter((t, i) => t.sentence === idx && i < shown).map((t) => t.text).join(' ');
    if (caption.textContent !== text) caption.textContent = text;
  }

  function showError({ title, text = '', retry = 'Try again' }) {
    panel.classList.remove('talking', 'listening');
    turn.hidden = true;
    errBox.replaceChildren(el('p', { class: 'schat-err-title' }, title), text ? el('p', null, text) : null,
      el('button', { type: 'button', class: 'pill primary', onclick: () => start() }, retry || 'Try again'));
    errBox.hidden = false;
  }

  async function start() {
    hangUp();
    errBox.hidden = true; turn.hidden = false; caption.textContent = '';
    setTurn(PHASE_LABEL.connecting);
    lastActivity = performance.now(); lastReplyId = 0; lastReplyLen = -1;
    const screen = getScreen();
    lastScreen = JSON.stringify(screen);
    const lines = DEMO ? await demoLines : null;
    const family = lines ? createFamilyVoice({ lines, onLine: (l) => { familyLine = l; if (l) caption.textContent = `${l.who}: ${l.text}`; } }) : null;
    const c = createVoiceClient({
      caseId, family,
      params: screen ? { screen: lastScreen } : {},
      handlers: {
        onError: (e) => { if (c === client) { hangUp(); showError(classifyError(e)); } },
        onClosed: (e) => { if (c === client) { hangUp(); showError(classifyError({ source: 'close', code: e.code })); } },
        onDone: () => { if (c === client) { hangUp(); showError({ title: 'Call ended', retry: 'Talk again' }); } },
        onReplyDone: (text) => { if (c === client) autopilot?.heard(text); },
      },
    });
    client = c;
    if (family) autopilot = createAutopilot({ voice: family, client: c, script: askOnce() });
    raf = requestAnimationFrame(frame);
    await c.start();
  }

  function hangUp() {
    autopilot?.stop(); autopilot = null; familyLine = null;
    cancelAnimationFrame(raf); raf = 0;
    const c = client; client = null;
    c?.stop();
    panel.classList.remove('talking', 'listening');
  }

  function open() {
    panel.hidden = false;
    root.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    close.focus();
    start(); // the tap is the user gesture the browser needs for the mic and for sound
  }
  function shut() {
    hangUp();
    panel.hidden = true;
    root.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
    fab.focus();
  }

  fab.addEventListener('click', () => (panel.hidden ? open() : shut()));
  close.addEventListener('click', shut);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });
  addEventListener('pagehide', hangUp); // never leave a paid voice session open

  // The family moved to another missions screen: tell Sherpy if the chat is open.
  function screenChanged() {
    if (!client) return;
    const screen = getScreen();
    const key = JSON.stringify(screen);
    if (key === lastScreen) return;
    lastScreen = key;
    client.send({ type: 'sherpy.screen', screen });
  }

  return { open, close: shut, screenChanged };
}
