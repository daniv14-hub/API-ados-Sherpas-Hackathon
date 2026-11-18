// GET /journey/<case>: tells the start screen whether this family already finished the getting-to-know-you
// conversation (so it can offer the video and the missions). It reveals that single flag and nothing else.
import { isAllowedCase } from './session.mjs';

const JOURNEY_RE = /^\/journey\/([^/]+)$/;

// GET /journey/<case> tells the page only whether the conversation is complete (no answers are exposed);
// it decides whether the video and missions arrows are unlocked.
export function parseJourneyPath(pathname, caseIds) {
  const m = JOURNEY_RE.exec(pathname);
  return m && isAllowedCase(m[1], caseIds) ? m[1] : null;
}

export function journeyView(profile) {
  return { phase1Complete: profile?.phase1Complete === true };
}
