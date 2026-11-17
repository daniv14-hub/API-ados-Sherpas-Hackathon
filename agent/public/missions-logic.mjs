// Pure logic of the missions screen (no DOM, no storage). scoreFor is passed in (it lives in /game-score.mjs for the browser).
// State: { v: 1, done: { [stepId]: true }, completed: [missionId, ...] }  (completed = order in which missions were finished)

export const emptyState = () => ({ v: 1, done: {}, completed: [] });

export function orderedMissions(data) {
  const byId = new Map(data.missions.map((m) => [m.id, m]));
  const ordered = (data.order ?? []).map((id) => byId.get(id)).filter(Boolean);
  const seen = new Set(ordered.map((m) => m.id));
  return [...ordered, ...data.missions.filter((m) => !seen.has(m.id))];
}

const isComplete = (m, done) => m.steps.length > 0 && m.steps.every((s) => done[s.id]);

// Drops anything the case data no longer knows about; returns a fresh, consistent state (also for garbage input).
export function sanitizeState(data, raw) {
  const out = emptyState();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return out;
  for (const m of data.missions) {
    for (const s of m.steps) {
      const prior = m.steps.slice(0, m.steps.indexOf(s)).every((p) => out.done[p.id]);
      if (raw.done?.[s.id] === true && prior) out.done[s.id] = true; // steps unlock in order
    }
  }
  const complete = new Set(data.missions.filter((m) => isComplete(m, out.done)).map((m) => m.id));
  const kept = (Array.isArray(raw.completed) ? raw.completed : []).filter((id, i, a) => complete.has(id) && a.indexOf(id) === i);
  out.completed = [...kept, ...orderedMissions(data).filter((m) => complete.has(m.id) && !kept.includes(m.id)).map((m) => m.id)];
  return out;
}

export function missionProgress(mission, state) {
  const done = mission.steps.filter((s) => state.done[s.id]).length;
  return { done, total: mission.steps.length, complete: isComplete(mission, state.done) };
}

export function stepUnlocked(mission, state, stepId) {
  const i = mission.steps.findIndex((s) => s.id === stepId);
  return i >= 0 && mission.steps.slice(0, i).every((s) => state.done[s.id]);
}

// Marks a step done (only if the steps above are done) or undoes it (and every later step of that mission).
// Returns { state, completedNow } where completedNow is the mission id finished by this change, if any.
export function toggleStep(data, state, missionId, stepId) {
  const mission = data.missions.find((m) => m.id === missionId);
  if (!mission || !mission.steps.some((s) => s.id === stepId)) return { state, completedNow: null };
  const done = { ...state.done };
  let completed = [...state.completed];
  if (done[stepId]) {
    for (const s of mission.steps.slice(mission.steps.findIndex((x) => x.id === stepId))) delete done[s.id];
    completed = completed.filter((id) => id !== missionId);
    return { state: { v: 1, done, completed }, completedNow: null };
  }
  if (!stepUnlocked(mission, state, stepId)) return { state, completedNow: null };
  done[stepId] = true;
  let completedNow = null;
  if (isComplete(mission, done) && !completed.includes(missionId)) {
    completed.push(missionId);
    completedNow = missionId;
  }
  return { state: { v: 1, done, completed }, completedNow };
}

export function progress(data, state) {
  const all = data.missions.flatMap((m) => m.steps);
  return { done: all.filter((s) => state.done[s.id]).length, total: all.length };
}

// 'done' | 'next' (first not finished, in order) | 'open'
export function missionStatuses(data, state) {
  const out = {};
  let nextFound = false;
  for (const m of orderedMissions(data)) {
    if (missionProgress(m, state).complete) out[m.id] = 'done';
    else if (!nextFound) { out[m.id] = 'next'; nextFound = true; } else out[m.id] = 'open';
  }
  return out;
}

export const nextMission = (data, state, afterId = null) => {
  const st = missionStatuses(data, state);
  const list = orderedMissions(data).filter((m) => st[m.id] !== 'done' && m.id !== afterId);
  return list[0] ?? null;
};

// Score moves of the finished missions (a mission without a move adds none).
export function doneMoves(data, completedIds) {
  return completedIds.map((id) => data.missions.find((m) => m.id === id)?.moveTitle).filter(Boolean);
}

// Exact lookup only (D6). Not exact -> the last exact score along the way the family finished missions, else the base.
export function scoreView(data, state, scoreFor) {
  const exact = scoreFor(data.table, doneMoves(data, state.completed));
  if (exact !== null && exact !== undefined) return { score: exact, exact: true };
  let last = data.table.base;
  for (let k = 1; k <= state.completed.length; k++) {
    const v = scoreFor(data.table, doneMoves(data, state.completed.slice(0, k)));
    if (v !== null && v !== undefined) last = v;
  }
  return { score: last, exact: false };
}

// Score of one mission alone (exact single-move lookup), for the card.
export const aloneScore = (data, mission, scoreFor) => (mission.moveTitle ? scoreFor(data.table, [mission.moveTitle]) : null);

// ---- formatting ----
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
export function formatFact(f) {
  const v = f.value;
  switch (f.fmt) {
    case 'usd': return typeof v === 'number' ? usd(v) : String(v);
    case 'pct': return typeof v === 'number' ? `${Number((v * 100).toFixed(2))}%` : String(v);
    case 'months': return typeof v === 'number' ? `${Number(v.toFixed(1))} months` : String(v);
    case 'date': {
      const m = /^(\d{4})-(\d{2})/.exec(String(v));
      return m && MONTHS[Number(m[2]) - 1] ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(v);
    }
    default: return String(v ?? '');
  }
}

// Single-person cases (no "&" in the label) never say "together" or "each".
export function ownerLabel(owner, single) {
  if (!owner) return null;
  if (single) return 'You';
  if (owner === 'together') return 'Together';
  if (owner === 'each') return 'Each of you';
  if (owner === 'you') return 'You';
  return String(owner);
}
export const isSingle = (label) => !String(label ?? '').includes('&');
export const STEP_TYPES = { learn: 'Learn', prepare: 'Prepare', decide: 'Decide', act: 'Act', close: 'Close' };
export const EFFORT = { low: 'Low effort', medium: 'Medium effort', high: 'High effort' };

// Checkpoint line: a fixed template filled with real data. No model, no invented numbers.
// `state` must already include the finished mission.
export function checkpoint(data, state, missionId, scoreFor) {
  const mission = data.missions.find((m) => m.id === missionId);
  const idx = state.completed.indexOf(missionId);
  const before = scoreFor(data.table, doneMoves(data, state.completed.filter((id) => id !== missionId)));
  const after = scoreFor(data.table, doneMoves(data, state.completed));
  let fact;
  if (mission?.moveTitle && before != null && after != null) {
    fact = before === after ? `Your score stays at ${after}.` : `Your score goes from ${before} to ${after}.`;
  } else {
    const f = mission?.facts?.find((x) => /gap/i.test(x.label)) ?? mission?.facts?.[0];
    fact = f ? `${f.label}: ${formatFact(f)}.` : null;
    if (mission?.scoreNote && !mission.moveTitle) fact = [fact, mission.scoreNote].filter(Boolean).join(' ');
  }
  const next = nextMission(data, state, missionId);
  const nextLine = next ? `Next up: ${next.title}.` : 'That was your last mission. Everything in your plan is now in motion.';
  return { title: mission ? `${mission.title} is done` : 'Mission done', fact, nextLine, nextId: next?.id ?? null, idx };
}

// ---------- views in the URL hash (so the phone Back button and deep links work) ----------
// overview -> '' · mission -> '#m-<id>' · checkpoint -> '#checkpoint-<id>'
export function viewHash(view) {
  if (view?.name === 'mission') return `#m-${encodeURIComponent(view.id)}`;
  if (view?.name === 'checkpoint') return `#checkpoint-${encodeURIComponent(view.id)}`;
  return '';
}

export function parseViewHash(hash) {
  const m = /^#(m|checkpoint)-(.+)$/.exec(typeof hash === 'string' ? hash : '');
  if (!m) return { name: 'overview' };
  let id;
  try { id = decodeURIComponent(m[2]); } catch { return { name: 'overview' }; }
  return m[1] === 'm' ? { name: 'mission', id } : { name: 'checkpoint', id, fromDone: null };
}

// A view from the URL may point at a mission that does not exist, or at a checkpoint not reached yet.
export function resolveView(data, state, view) {
  if (view.name !== 'mission' && view.name !== 'checkpoint') return { name: 'overview' };
  const mission = data.missions.find((m) => m.id === view.id);
  if (!mission) return { name: 'overview' };
  if (view.name === 'checkpoint' && !state.completed.includes(view.id)) return { name: 'mission', id: view.id };
  return view;
}
