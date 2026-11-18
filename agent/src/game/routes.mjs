import { isAllowedCase } from '../session.mjs';

const MISSIONS_RE = /^\/missions\/([^/]+)$/;

// '/missions/<case>' -> caseId when it is on the allow-list, else null.
export function parseMissionsPath(pathname, caseIds) {
  const m = MISSIONS_RE.exec(pathname);
  return m && isAllowedCase(m[1], caseIds) ? m[1] : null;
}

const strip = ({ src, verify, ...rest }) => rest; // data paths stay on the server

// What the browser gets: missions, facts (values and labels only) and the score table for exact lookups.
export function missionsView(loaded, label) {
  return {
    caseId: loaded.caseId,
    label,
    base: loaded.base,
    table: loaded.table,
    order: loaded.order,
    source: loaded.source,
    missions: loaded.missions.map((m) => ({
      id: m.id, title: m.title, kind: m.kind, effort: m.effort ?? null, moveTitle: m.moveTitle ?? null, scoreNote: m.scoreNote ?? null,
      facts: (m.facts ?? []).map(strip),
      steps: (m.steps ?? []).map((s) => ({ id: s.id, type: s.type, owner: s.owner ?? null, title: s.title, body: s.body ?? '', kit: s.kit ?? null, ui: s.ui ?? null })),
    })),
    keepInView: (loaded.keepInView ?? []).map((k) => ({ id: k.id, title: k.title, body: k.body, facts: (k.facts ?? []).map(strip) })),
  };
}
