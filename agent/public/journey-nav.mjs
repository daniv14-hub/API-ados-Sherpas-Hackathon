// ‹ previous / next › arrows at the bottom of the three journey screens (talk, video, missions).
// Rules live in journey-logic.mjs (journeyNav); this file only draws them. Text only, never innerHTML with data.
import { journeyNav } from './journey-logic.mjs';
import { leaveTo } from './handoff.mjs';

// Styles injected once by this component (shared by the three pages).
const CSS = `
.jnav { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; }
.jnav-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 18px; border-radius: 999px;
  font: 600 15px var(--font-body); text-decoration: none; cursor: pointer; white-space: nowrap;
  background: #fff; color: var(--gray-900); border: 1px solid var(--gray-300); }
.jnav-btn .arr { font-size: 22px; line-height: 1; margin-top: -2px; }
.jnav-btn:hover { border-color: var(--brand-400); }
.jnav-btn:focus-visible { outline: 3px solid var(--brand-300); outline-offset: 2px; }
.jnav-btn[aria-disabled="true"] { background: var(--gray-100); color: var(--gray-500); border-color: var(--gray-200); cursor: not-allowed; }
.jnav-hint { flex: 1; min-width: 0; margin: 0; text-align: center; font-size: 13px; line-height: 1.35; color: var(--gray-600); }
.jnav[data-look="sticker"] .jnav-btn { border: 3px solid var(--ink, #0b0f2e); box-shadow: 3px 3px 0 var(--ink, #0b0f2e); color: var(--ink, #0b0f2e); }
.jnav[data-look="sticker"] .jnav-btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink, #0b0f2e); }
`;

function injectCss() {
  if (document.getElementById('jnav-css')) return;
  const s = document.createElement('style');
  s.id = 'jnav-css';
  s.textContent = CSS;
  document.head.append(s);
}

const LOCKED_HINT = 'Finish your talk with Sherpy first. Your video comes right after.';

// step: 'talk' | 'video' | 'missions'. complete: true/false, or undefined to ask the server (GET /journey/<case>).
export function mountJourneyNav({ step, caseId, parent, look = 'soft', complete }) {
  injectCss();
  const nav = document.createElement('nav');
  nav.className = 'jnav';
  nav.dataset.look = look;
  nav.setAttribute('aria-label', 'Your journey');
  parent.append(nav);
  let current = { caseId, complete: complete ?? false };
  let hintTimer = 0;
  let seq = 0;

  function button(item, dir) {
    if (!item) return document.createElement('span');
    const arrow = document.createElement('span');
    arrow.className = 'arr';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = dir === 'prev' ? '‹' : '›';
    const label = document.createElement('span');
    label.textContent = item.label;
    const ariaLabel = `${dir === 'prev' ? 'Back to' : 'Next:'} ${item.label}`;
    let el;
    if (item.locked) {
      el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('aria-label', `${ariaLabel} (available after your talk with Sherpy)`);
      el.onclick = () => showHint(LOCKED_HINT);
    } else {
      el = document.createElement('a');
      el.href = item.href;
      el.setAttribute('aria-label', ariaLabel);
      el.onclick = (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab: let the browser do it
        e.preventDefault();
        leaveTo(item.href);
      };
    }
    el.classList.add('jnav-btn', dir);
    el.append(...(dir === 'prev' ? [arrow, label] : [label, arrow]));
    return el;
  }

  const hint = document.createElement('p');
  hint.className = 'jnav-hint';
  hint.setAttribute('role', 'status');
  function showHint(text) {
    clearTimeout(hintTimer);
    hint.textContent = text;
    hintTimer = setTimeout(() => { hint.textContent = ''; }, 4000);
  }

  function render() {
    const { prev, next } = journeyNav(step, current);
    nav.replaceChildren(button(prev, 'prev'), hint, button(next, 'next'));
  }

  async function ask(id) {
    const mine = ++seq;
    let done = false;
    try {
      const r = await fetch(`/journey/${encodeURIComponent(id)}`, { cache: 'no-store' });
      done = r.ok && (await r.json()).phase1Complete === true;
    } catch { done = false; }
    if (mine === seq) { current = { caseId: id, complete: done }; render(); }
  }

  render();
  if (complete === undefined && step !== 'missions') ask(caseId);

  return {
    el: nav,
    // New family or the conversation just finished. complete undefined = ask the server again.
    update({ caseId: id = current.caseId, complete: c } = {}) {
      if (c === undefined) { current = { ...current, caseId: id }; render(); ask(id); return; }
      seq++; current = { caseId: id, complete: c }; render();
    },
  };
}
