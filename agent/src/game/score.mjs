// Pure score lookup (D6, handoff R2). No imports: this file is also served to the browser.
// table = { base, moves: { [title]: score_after }, combos: [{ moves: [title], score_after }] }

export function scoreFor(table, doneMoveTitles) {
  const done = [...new Set(doneMoveTitles ?? [])];
  if (done.length === 0) return table.base;
  if (done.length === 1) return table.moves[done[0]] ?? null;
  for (const combo of table.combos ?? []) {
    if (combo.moves.length === done.length && combo.moves.every((m) => done.includes(m))) return combo.score_after;
  }
  return null; // no exact match: never add or average
}

// Builds the table from financial-health.json (score.published_score / top_moves / combined_moves).
export function buildScoreTable(fh) {
  const s = fh.score;
  return {
    base: s.published_score,
    moves: Object.fromEntries((s.top_moves ?? []).map((m) => [m.title, m.score_after])),
    combos: (s.combined_moves ?? []).map((c) => ({ moves: [...c.moves], score_after: c.score_after })),
  };
}
