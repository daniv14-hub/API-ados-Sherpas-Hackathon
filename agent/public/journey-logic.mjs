// Pure rules for the journey hand-off: conversation -> video -> missions. No DOM here (unit-tested in node).

// Pure rules of the three-screen journey (conversation -> video -> missions), tested in node.
export const DEFAULT_CASE = 'daniel-emily-johnson';

// Waits (ms) between GET /video/<case> attempts that answer 409: the profile write can land a moment after
// the conversation ends. After the last one we give up and offer a retry.
export const PROFILE_RETRY_MS = [700, 1200, 2000, 3000, 4000];

// How long the end card stays before the page moves on to the missions.
export const END_CARD_MS = 2200;

// ?case=<id>&flow=1 -> { caseId, flow }. Only "1" switches the flow on.
export function readJourneyParams(search) {
  const p = new URLSearchParams(search ?? '');
  return { caseId: p.get('case') || DEFAULT_CASE, flow: p.get('flow') === '1' };
}

const q = (caseId) => `case=${encodeURIComponent(caseId)}`;
export const videoUrl = (caseId, { flow = false } = {}) => `/video.html?${q(caseId)}${flow ? '&flow=1' : ''}`;
export const missionsUrl = (caseId) => `/missions.html?${q(caseId)}`;

// What to do after a GET /video/<case> answer. status 0 = network error.
// -> { do: 'go' } | { do: 'wait', ms } | { do: 'fail', reason: 'incomplete' | 'error' }
export function nextVideoStep(status, attempt) {
  if (status === 200) return { do: 'go' };
  if (status === 409) {
    return attempt < PROFILE_RETRY_MS.length ? { do: 'wait', ms: PROFILE_RETRY_MS[attempt] } : { do: 'fail', reason: 'incomplete' };
  }
  return { do: 'fail', reason: 'error' };
}

// The "turn your phone sideways" hint: portrait phone or small tablet, until the family says "play here anyway".
export function showRotateHint({ width, height, dismissed }) {
  return !dismissed && height > width && width <= 900;
}

// Flow mode autoplay waits while the rotate hint is up (the hint's own button is the gesture that starts it).
export function shouldAutoplay({ flow, rotateHint }) {
  return flow && !rotateHint;
}

export const talkUrl = (caseId) => `/?${q(caseId)}`;

// The ‹ previous / next › arrows of the three journey screens. Nobody gets stuck on a screen, except that the
// video and the missions only open once the conversation is complete (team, 18/11): Sherpy needs the answers first.
// -> { prev, next }, each null or { label, href, locked }.
export function journeyNav(step, { caseId, complete = false }) {
  const link = (label, href, locked = false) => ({ label, href, locked });
  if (step === 'talk') return { prev: null, next: link('Video', videoUrl(caseId), !complete) };
  if (step === 'video') return { prev: link('Talk', talkUrl(caseId)), next: link('Missions', missionsUrl(caseId), !complete) };
  if (step === 'missions') return { prev: link('Video', videoUrl(caseId)), next: null };
  throw new Error(`unknown step: ${step}`);
}
