// Journey hand-off between pages: conversation -> video -> missions.
// Importing this file does nothing; pages call the functions they need.
import { nextVideoStep, videoUrl, missionsUrl, readJourneyParams } from './journey-logic.mjs';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Browsers with cross-document view transitions (CSS @view-transition) animate the navigation themselves;
// PageRevealEvent ships with them. Others get a short fade-out first.
const hasCrossDocTransitions = () => typeof window.PageRevealEvent === 'function';

export function leaveTo(url) {
  const to = new URL(url, location.href).pathname;
  if (reducedMotion() || (hasCrossDocTransitions() && TRANSITION_PAGES.has(to))) { location.assign(url); return; }
  document.documentElement.classList.add('leaving');
  // Back button: the browser may restore this page from its back/forward cache, still faded out. Show it again.
  addEventListener('pageshow', (e) => { if (e.persisted) document.documentElement.classList.remove('leaving'); }, { once: true });
  setTimeout(() => location.assign(url), 320);
}

// Only the conversation and the video pages opt in to cross-document view transitions (the missions page does not:
// Chrome aborts captures of it with "invalid state"). Going anywhere else, drop the transition quietly.
const TRANSITION_PAGES = new Set(['/', '/index.html', '/video.html']);
export function limitViewTransitions() {
  addEventListener('pageswap', (e) => {
    const vt = e.viewTransition;
    if (!vt) return;
    let to = '';
    try { to = new URL(e.activation?.entry?.url ?? '', location.href).pathname; } catch { /* unknown target */ }
    if (TRANSITION_PAGES.has(to)) return;
    vt.ready.catch(() => {}); vt.finished.catch(() => {}); vt.updateCallbackDone?.catch(() => {});
    vt.skipTransition();
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// GET /video/<case> until it is ready. The server starts the build when the conversation ends, so this
// usually waits for that build (about 5-10 s). Resolves to { ok: true } or { ok: false, reason }.
export async function awaitVideo(caseId, { fetchFn = fetch, sleep = wait } = {}) {
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    try { status = (await fetchFn(`/video/${encodeURIComponent(caseId)}`, { cache: 'no-store' })).status; } catch { status = 0; }
    const step = nextVideoStep(status, attempt);
    if (step.do === 'go') return { ok: true };
    if (step.do === 'fail') return { ok: false, reason: step.reason };
    await sleep(step.ms);
  }
}

// Conversation page: after Sherpy's goodbye (event "sherpy:done"), wait for the video and move on to it.
export function initConversationHandoff() {
  limitViewTransitions();
  const $ = (id) => document.getElementById(id);
  const FAIL = {
    incomplete: ['Sherpy is still saving your answers', 'Give it a moment and try again.'],
    error: ["We couldn't finish your video", "Your answers are saved. Let's try that again."],
  };

  async function run(caseId) {
    const stage = $('callstage');
    stage.classList.add('busy');
    $('making').classList.remove('failed');
    $('making-title').textContent = 'Sherpy is putting your video together';
    $('making-sub').textContent = 'This only takes a few seconds.';
    $('making-fail').hidden = true;
    const r = await awaitVideo(caseId);
    if (r.ok) return leaveTo(videoUrl(caseId, { flow: true }));
    stage.classList.remove('busy');
    $('making').classList.add('failed');
    const [title, sub] = FAIL[r.reason] ?? FAIL.error;
    $('making-title').textContent = title;
    $('making-sub').textContent = sub;
    $('making-missions').href = missionsUrl(caseId);
    $('making-retry').onclick = () => run(caseId);
    $('making-fail').hidden = false;
    $('making-retry').focus();
  }

  addEventListener('sherpy:done', (e) => run(e.detail?.caseId));
  // Back from the video: a page restored from the back/forward cache would sit in "putting your video together"
  // forever. Load it fresh instead (the start screen then offers the video and the missions).
  addEventListener('pageshow', (e) => { if (e.persisted && $('callstage').classList.contains('making')) location.reload(); });
}

// Conversation start screen: a family that already talked with Sherpy also gets "Watch your video" and "My missions".
export function initReturningFamily({ onStatus } = {}) {
  const $ = (id) => document.getElementById(id);
  const copy = {
    first: { title: "Hi, I'm Sherpy", text: "Let's talk through your plan together. I'll ask a few questions, and you just answer out loud.", go: 'Start' },
    back: { title: 'Welcome back', text: 'Your video and your missions are ready. You can also talk to Sherpy about your plan.', go: 'Talk to Sherpy' },
  };
  let seq = 0;

  async function check(caseId) {
    const mine = ++seq;
    let back = false;
    try {
      const r = await fetch(`/journey/${encodeURIComponent(caseId)}`, { cache: 'no-store' });
      back = r.ok && (await r.json()).phase1Complete === true;
    } catch { back = false; }
    if (mine !== seq) return; // the family changed meanwhile
    onStatus?.(caseId, back);
    const c = back ? copy.back : copy.first;
    $('start-title').textContent = c.title;
    $('start-text').textContent = c.text;
    $('go').textContent = c.go;
    $('back-actions').hidden = !back;
    $('start').classList.toggle('returning', back);
    if (back) {
      $('watch-video').href = videoUrl(caseId);
      $('my-missions').href = missionsUrl(caseId);
    }
  }

  $('family').addEventListener('change', (e) => check(e.target.value));
  check(readJourneyParams(location.search).caseId);
}
