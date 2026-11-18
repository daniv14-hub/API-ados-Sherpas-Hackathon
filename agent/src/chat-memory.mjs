// What the family and Sherpy said in the "Ask Sherpy" chat (phase 2), kept in server memory per case, so a chat
// closed and opened again carries on instead of greeting again (team, 18/11). Lost on restart, on purpose:
// it is a convenience, the transcripts on disk stay the record.
export function createChatMemory({ ttlMs = 2 * 60 * 60 * 1000, maxLines = 24, now = Date.now } = {}) {
  const byCase = new Map(); // caseId -> { at, lines: [{ role, text }] }
  return {
    get(caseId) {
      const e = byCase.get(caseId);
      if (!e || now() - e.at > ttlMs) return [];
      return e.lines.map((l) => ({ ...l }));
    },
    add(caseId, role, text) {
      if (typeof text !== 'string' || !text.trim()) return;
      const e = byCase.get(caseId);
      const lines = e && now() - e.at <= ttlMs ? e.lines : [];
      lines.push({ role, text: text.trim().slice(0, 600) });
      byCase.set(caseId, { at: now(), lines: lines.slice(-maxLines) });
    },
  };
}
