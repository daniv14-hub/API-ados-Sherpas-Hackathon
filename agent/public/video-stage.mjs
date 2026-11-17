// The seven scenes of the explainer video ("roller coaster", spec Revision 2), in the Sherpas sticker look (D10):
// up (dream) -> down (reality, gaps, fragility) -> relief (turn, act, mission).
// Contract: renderScene(stageEl, scene, { reducedMotion }) -> { at(t), dispose() }; t = seconds inside the scene.
// Every number on screen is a value from scene.props (bars may be proportional; labels are the data values).
import { estimateDuration } from './video-time.mjs';
import { money, el, html, motion, cue, sentenceCue, icon, goalIcon, topicIcon, moveIcon, sherpy, preloadSherpy } from './video-shapes.mjs';

const SCENES = { dream, reality, gaps, fragility, turn, act, mission };

export function renderScene(stageEl, scene, { reducedMotion = false } = {}) {
  preloadSherpy();
  const root = el('div', `sc sc-${scene.id}`);
  stageEl.append(root);
  const duration = scene.duration ?? estimateDuration(scene.text);
  const m = motion(reducedMotion);
  const draw = SCENES[scene.id];
  if (draw) draw(root, scene.props ?? {}, { m, scene, D: Math.max(1, duration) });
  return {
    at(t) { m.at(t); },
    dispose() { m.dispose(); root.remove(); },
  };
}

// ---------------------------------------------------------------- shared bits

// Headline with the key word on a brand-blue block: headline(['Your ', ['goals']]).
function headline(root, parts, m, at = 0) {
  const h = el('h2', 'hl');
  for (const p of parts) {
    if (Array.isArray(p)) {
      const hi = el('span', 'hi', p[0]);
      h.append(hi);
      m.pop(hi, at + 0.25, { from: 0.4 });
    } else h.append(p);
  }
  root.append(h);
  m.play(h, [{ opacity: 0, translate: '0 -24px' }, { opacity: 1, translate: '0 0' }], { at, dur: 0.35 });
  return h;
}

const tone = (colour) => (['red', 'yellow', 'green'].includes(colour) ? `tone-${colour}` : 'tone-brand');
const names = (people) => (people.length <= 2 ? people.join(' & ') : `${people.slice(0, -1).join(', ')} & ${people.at(-1)}`);
const childOf = (g) => (g.type === 'college' && /^college\s+\S/i.test(g.label ?? '') ? g.label.replace(/^college\s+/i, '') : null);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function decor(root) {
  root.append(el('div', 'blob b1'), el('div', 'blob b2'));
}

// A have-vs-missing bar. Widths are proportional to the two values; no share is ever printed.
// Returns the bar and grow(atHave, atMiss) to schedule the two segments.
function splitBar(have, miss, m) {
  const bar = el('div', 'sbar');
  const h = el('div', 'seg have');
  const x = el('div', 'seg miss');
  bar.append(h, x);
  const share = isNum(have) && have > 0 ? have / (have + miss) : 0;
  h.style.width = '0%'; x.style.width = '0%'; x.style.left = `${share * 100}%`;
  if (share === 0) x.classList.add('alone');
  return {
    bar,
    grow(atHave, atMiss) {
      if (share > 0) m.tween(atHave, 0.6, (k) => { h.style.width = `${share * 100 * k}%`; });
      m.tween(atMiss, 0.8, (k) => { x.style.width = `${(1 - share) * 100 * k}%`; });
    },
  };
}

// ---------------------------------------------------------------- 1. dream (up)

function postcard(g, { main, stamp, retirement }) {
  const card = el('div', `card postcard${main ? ' main' : ''}`);
  const sky = html('div', `sky sky-${g.type}`, icon(goalIcon(g)));
  const body = el('div', 'pbody');
  const kid = childOf(g);
  const what = kid ?? (g.type === 'vacation' ? 'Vacation' : g.type === 'retirement' ? 'Retirement'
    : g.type === 'purchase' ? (/vehicle|car/i.test(g.label ?? '') ? 'New car' : 'New home') : g.label);
  if (kid) body.append(el('div', 'sub', 'College'));
  body.append(el('div', 'title', what));
  if (g.type === 'retirement' && retirement?.ages) {
    const ages = Object.entries(retirement.ages);
    if (ages.length) body.append(el('div', 'detail', ages.map(([n, a]) => (ages.length > 1 ? `${n} ${a}` : `at ${a}`)).join(' · ')));
  }
  if (isNum(g.amount)) body.append(el('div', 'amount', money(g.amount)));
  if (g.type === 'vacation' && g.yearly) body.append(el('div', 'sub', 'every year'));
  card.append(sky, body);
  if (stamp) card.append(el('div', 'stamp small tone-brand corner', 'Main goal'));
  return card;
}

function dream(root, { people = [], goals = [], retirement = null }, { m, scene, D }) {
  decor(root);
  headline(root, ['Every goal ', ['met']], m, 0);
  const kicker = el('div', 'kicker', names(people));
  root.append(kicker);
  m.pop(kicker, 0.15);

  const s = sherpy({ arm: true });
  s.wrap.classList.add('cheer');
  root.append(s.wrap);
  m.pop(s.wrap, 0.1, { from: 0.3 });
  m.bob(s.rig, 0.6, { dy: 6 });
  if (!m.reduced) m.play(s.arm, [{ rotate: '-12deg' }, { rotate: '14deg' }], { at: 0.4, dur: 0.4, easing: 'ease-in-out', iterations: Infinity, direction: 'alternate' });

  // Postcards in time order along a road; the main goal (planScenes puts it first) is drawn bigger.
  const mainType = goals[0]?.type;
  const list = goals.filter((g) => isNum(g.year)).map((g, i) => ({ g, i })).sort((a, b) => a.g.year - b.g.year || a.i - b.i);
  root.classList.add(list.length > 4 ? 'many' : 'few');
  const road = el('div', 'road');
  const row = el('div', 'cards');
  root.append(road, row);
  m.play(road, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { at: 0.2, dur: 0.9 });
  const tFirst = 0.12 * D;
  let stamped = false; // one "Main goal" stamp, on the first card of that type
  const fallbackStep = Math.min(0.7, (0.6 * D) / Math.max(1, list.length));
  list.forEach(({ g }, i) => {
    const col = el('div', 'stop');
    const main = g.type === mainType;
    const card = postcard(g, { main, stamp: main && !stamped, retirement });
    stamped ||= main;
    card.style.rotate = `${[-2.5, 1.5, -1, 2, -1.5, 1][i % 6]}deg`;
    const pin = el('div', 'pin', g.type === 'vacation' && g.yearly ? `from ${g.year}` : String(g.year));
    col.append(card, pin);
    row.append(col);
    // Each card lands when the narration names it: a child by name, an amount, else the year.
    const said = childOf(g) ?? (g.type !== 'retirement' && isNum(g.amount) ? money(g.amount) : String(g.year));
    const at = Math.max(tFirst, cue(scene, D, said, (tFirst + i * fallbackStep) / D));
    m.pop(pin, at, { from: 0.5 });
    m.pop(card, at + 0.1);
    m.bob(card, at + 0.7, { dy: 4, dur: 2 + (i % 3) * 0.3 });
  });
}

// ---------------------------------------------------------------- 2. reality (down)

function dial(score, colour) {
  const r = 150;
  const c = 2 * Math.PI * r;
  const box = el('div', 'dial card');
  box.innerHTML = `<svg viewBox="0 0 360 360" aria-hidden="true">
    <circle cx="180" cy="180" r="${r}" fill="none" stroke="var(--gray-100)" stroke-width="36"/>
    <circle class="arc" cx="180" cy="180" r="${r}" fill="none" stroke-width="36" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 180 180)"/></svg>`;
  box.querySelector('.arc').classList.add(`stroke-${tone(colour)}`);
  const num = el('div', 'num', '0');
  box.append(num, el('div', 'of', 'out of 100'));
  return {
    box,
    set(p) {
      num.textContent = String(Math.round(score * p));
      box.querySelector('.arc').setAttribute('stroke-dashoffset', String(c * (1 - (score / 100) * p)));
    },
  };
}

function reality(root, { score, band, colour, weakest }, { m, scene, D }) {
  decor(root);
  headline(root, ['Where you ', ['stand'], ' today'], m, 0);
  const d = dial(score, colour);
  root.append(d.box);
  m.pop(d.box, 0.04 * D, { from: 0.6 });
  const tScore = cue(scene, D, String(score), 0.2);
  const t0 = Math.min(tScore, 0.12 * D);
  m.tween(t0, Math.max(0.6, tScore + 0.5 - t0), d.set);
  d.set(0);

  const bandStamp = el('div', `stamp band ${tone(colour)}`, band);
  root.append(bandStamp);
  const tBand = Math.max(tScore + 0.6, cue(scene, D, band, 0.35));
  m.pop(bandStamp, tBand, { from: 2 });

  // "Not on track" when the narration says so, or the band is critical/vulnerable.
  const said = /not on track/i.test(scene.text ?? '');
  if (said || /^(critical|vulnerable)$/i.test(band ?? '')) {
    const yet = said && /not on track for all of it yet/i.test(scene.text ?? '');
    const off = el('div', 'stamp offtrack tone-red', yet ? 'Not on track yet' : 'Not on track');
    root.append(off);
    m.pop(off, Math.min(0.08 * D, Math.max(0.3, tScore - 0.6)), { from: 2.4 });
  }

  if (!weakest) return;
  const tWeak = Math.max(tBand + 0.5, cue(scene, D, weakest.name, 0.55, tBand));
  const card = el('div', 'card weakest');
  const [got, of] = String(weakest.points ?? '').split('/');
  const pts = el('div', 'pts');
  pts.append(el('span', 'got', got), el('span', 'of', of !== undefined ? `/${of}` : ''));
  card.append(el('div', 'label', 'Most exposed'), el('div', 'name', weakest.name), pts);
  root.append(card);
  m.pop(card, tWeak);
  m.pop(pts, Math.max(tWeak + 0.5, cue(scene, D, got, 0.7, tWeak)), { from: 2 });
}

// ---------------------------------------------------------------- 3. gaps

const GAP_TITLE = { college: 'College', retirement: 'Retirement', cash: 'Emergency cash', debt: 'Card debt' };

function gapRow(item, noRetirementSaving, m, at, tSay) {
  const row = el('div', `card grow g-${item.topic}`);
  row.append(html('div', 'disc', icon(topicIcon(item.topic))));
  const main = el('div', 'gmain');
  const top = el('div', 'gtop');
  top.append(el('div', 'gtitle', GAP_TITLE[item.topic] ?? item.label ?? ''));
  main.append(top);
  row.append(main);

  if (item.topic === 'cash') {
    // One cell per month up to the top of the recommended range; filled cells are the months covered.
    const cells = el('div', 'cells');
    const total = Math.max(item.maxMonths, item.months);
    for (let k = 0; k < total; k++) {
      const c = el('div', `cell${k < item.months ? ' have' : k < item.minMonths ? ' miss' : ' range'}`);
      cells.append(c);
      m.pop(c, tSay + k * 0.06, { from: 0.4 });
    }
    const unit = item.months === 1 ? 'month' : 'months';
    top.append(el('div', 'gnote', `${item.months} ${unit} of cash`), el('div', 'gmiss', `${item.minMonths}–${item.maxMonths} recommended`));
    main.append(cells);
    return row;
  }

  const have = item.have;
  if (item.topic === 'retirement' && noRetirementSaving) top.append(el('div', 'gnote warn', 'Nothing goes in today'));
  else if (isNum(have) && have > 0) top.append(el('div', 'gnote', `${money(have)} saved`));
  else if (isNum(have) && have === 0) top.append(el('div', 'gnote warn', 'Nothing saved'));
  const missWord = item.topic === 'retirement' ? 'short' : item.topic === 'debt' ? (item.gapLabel ?? '') : 'missing';
  const miss = el('div', 'gmiss');
  miss.append(el('span', 'amt', money(item.gap)), el('span', 'what', missWord));
  top.append(miss);
  const b = splitBar(have, item.gap, m);
  main.append(b.bar);
  b.grow(at + 0.3, tSay);
  m.pop(miss, tSay + 0.3, { from: 1.6 });
  return row;
}

function gaps(root, { items = [], noRetirementSaving = false }, { m, scene, D }) {
  decor(root);
  headline(root, ['How far each ', ['goal'], ' is'], m, 0);
  const list = el('div', `grows n${items.length}`);
  root.append(list);
  let prev = 0.06 * D;
  items.forEach((item, i) => {
    const key = item.topic === 'cash' ? String(item.months) : money(item.gap);
    const fallback = 0.12 + i * (0.7 / Math.max(1, items.length));
    // The row appears as its sentence starts; its bar grows when the amount is said.
    const at = i === 0 ? Math.min(0.15 * D, sentenceCue(scene, D, key, fallback)) : Math.max(prev + 0.8, sentenceCue(scene, D, key, fallback, prev + 0.4));
    const tSay = Math.max(at + 0.3, cue(scene, D, key, fallback, at));
    const row = gapRow(item, noRetirementSaving, m, at, tSay);
    list.append(row);
    m.pop(row, at, { from: 0.8 });
    prev = at;
  });
}

// ---------------------------------------------------------------- 4. fragility

function fragility(root, { people = [] }, { m, scene, D }) {
  decor(root);
  headline(root, people.length === 1 ? ['If your ', ['paycheck'], ' stopped'] : ['If one ', ['paycheck'], ' stopped'], m, 0);
  const sub = el('div', 'kicker', 'Life cover today');
  root.append(sub);
  m.pop(sub, 0.2);
  const list = el('div', `frows n${people.length}`);
  root.append(list);
  let prev = 0.1 * D;
  people.forEach((p, i) => {
    const row = el('div', 'card frow');
    const who = el('div', 'who');
    who.append(html('div', 'disc', icon('shield')), el('div', 'name', p.name));
    const main = el('div', 'fmain');
    const labels = el('div', 'flabels');
    if (isNum(p.cover)) {
      const c = el('div', 'cover');
      c.append(el('span', 'amt', money(p.cover)), el('span', 'what', 'cover'));
      labels.append(c);
    }
    const s = el('div', 'short');
    s.append(el('span', 'amt', money(p.shortfall)), el('span', 'what', 'short'));
    labels.append(s);
    const b = splitBar(p.cover, p.shortfall, m);
    main.append(labels, b.bar);
    row.append(who, main);
    list.append(row);
    const at = Math.max(prev + (i ? 0.8 : 0), cue(scene, D, p.name, 0.2 + i * 0.35, prev) - 0.2);
    m.pop(row, at, { from: 0.8 });
    const tShort = Math.max(at + 0.9, cue(scene, D, money(p.shortfall), (at + 1) / D, at));
    b.grow(at + 0.3, tShort);
    m.pop(s, tShort + 0.3, { from: 1.6 });
    prev = at;
  });
}

// ---------------------------------------------------------------- 5. turn (relief)

function turn(root, { freeCashFlow = null }, { m, scene, D }) {
  root.append(el('div', 'blob b1'), el('div', 'blob b2'), el('div', 'sun'));
  headline(root, ['One step at a ', ['time']], m, 0.1);
  const s = sherpy({ arm: true });
  s.wrap.classList.add('guide');
  root.append(s.wrap);
  m.slideIn(s.wrap, 0.05 * D, { x: -700 });
  m.bob(s.rig, 0.9, { dy: 7 });
  if (!m.reduced) m.play(s.arm, [{ rotate: '-10deg' }, { rotate: '12deg' }], { at: 0.8, dur: 0.5, easing: 'ease-in-out', iterations: Infinity, direction: 'alternate' });

  const bubble = el('div', 'bubble', 'This has a solution');
  root.append(bubble);
  m.pop(bubble, 0.15 * D);

  // Steps to come: three dotted outlines climbing to a flag (no count is claimed; they stand for "the steps").
  const stairs = el('div', 'stairs');
  for (let k = 0; k < 3; k++) {
    const st = el('div', `step s${k}`);
    stairs.append(st);
    m.pop(st, 0.3 * D + k * 0.35, { from: 0.6 });
  }
  const flag = html('div', 'sflag', icon('flag'));
  stairs.append(flag);
  root.append(stairs);
  m.pop(flag, 0.3 * D + 1.1, { from: 0.3 });
  m.loop(flag, [{ rotate: '-6deg' }, { rotate: '6deg' }], { at: 0.3 * D + 1.6, dur: 1 });

  if (isNum(freeCashFlow)) {
    const chip = el('div', 'card fcf');
    chip.append(el('div', 'amt', money(freeCashFlow)), el('div', 'what', 'free each year'));
    root.append(chip);
    m.pop(chip, Math.max(0.2 * D, cue(scene, D, money(freeCashFlow), 0.35)), { from: 0.5 });
  }
}

// ---------------------------------------------------------------- 6. act

// What each move fixes, from the link planScenes gives it (fragility / protection / retirement / null).
function linkLabel(mv) {
  if (mv.link === 'fragility') return 'Closes the cover shortfall';
  if (mv.link === 'retirement') return 'Starts on the retirement gap';
  if (mv.link === 'protection') return /umbrella/i.test(mv.title) ? "Protects what you've built" : 'Raises your protection';
  return null;
}

function chips(before, after) {
  const box = el('div', 'chips');
  box.append(el('span', 'chip before', before), el('span', 'to', '→'), el('span', `chip after${after > before ? ' up' : ''}`, after));
  return box;
}

function act(root, { moves = [], combined = null, before }, { m, scene, D }) {
  decor(root);
  root.classList.toggle('solo', !combined);
  headline(root, ['If you ', ['act']], m, 0);
  const list = el('div', `moves n${moves.length}`);
  const step = Math.min(0.9, (0.45 * D) / Math.max(1, moves.length));
  moves.forEach((mv, i) => {
    const card = el('div', 'card move');
    const text = el('div', 'mtext');
    text.append(el('div', 'title', mv.title));
    const lab = linkLabel(mv);
    if (lab) text.append(el('div', 'link', lab));
    card.append(html('div', 'disc', icon(moveIcon(mv.title))), text, chips(mv.before, mv.after));
    list.append(card);
    m.pop(card, 0.08 * D + i * step, { from: 0.7 });
  });
  root.append(list);

  if (!combined) return;
  const shown = new Set(moves.map((x) => x.title));
  const together = combined.moves.every((x) => shown.has(x));
  const box = el('div', 'card combined');
  const num = el('div', 'num up', before);
  box.append(el('div', 'stamp small tone-brand corner', together ? 'Together' : 'With your other steps'),
    el('div', 'label', 'Your score'), el('div', 'from', before), el('div', 'arrow', '↓'), num);
  root.append(box);
  const tBox = Math.max(0.08 * D + moves.length * step, cue(scene, D, String(combined.after), 0.55) - 0.8);
  m.pop(box, tBox);
  const tAfter = Math.max(tBox + 0.5, cue(scene, D, String(combined.after), 0.7));
  m.tween(tBox + 0.4, Math.max(0.6, tAfter - tBox), (k) => { num.textContent = String(Math.round(before + (combined.after - before) * k)); });
  if (!m.reduced) m.play(num, [{ scale: '1' }, { scale: '1.25' }, { scale: '1' }], { at: tAfter + 0.1, dur: 0.5 });
}

// ---------------------------------------------------------------- 7. mission

function mission(root, { mission: title, year = null, goal = null }, { m, scene, D }) {
  decor(root);
  headline(root, ['Your first ', ['mission']], m, 0);
  const s = sherpy({ arm: true });
  s.wrap.classList.add('presenter');
  root.append(s.wrap);
  m.slideIn(s.wrap, 0.02 * D);
  m.bob(s.rig, 0.8, { dy: 6 });
  if (!m.reduced) m.play(s.arm, [{ rotate: '-6deg' }, { rotate: '8deg' }], { at: 0.6, dur: 0.5, easing: 'ease-in-out', iterations: Infinity, direction: 'alternate' });

  const card = el('div', 'card mission');
  const tab = el('div', 'stamp tone-brand tab', 'Mission 1');
  const body = el('div', 'mbody');
  body.append(html('div', 'disc', icon(moveIcon(title))), el('div', 'title', title));
  const prog = el('div', 'progress');
  // Back to the dream: the bar ends at the main goal's postcard and year (or a plain flag without one).
  const hasYear = isNum(year);
  const end = hasYear ? el('div', 'card back') : html('div', 'pflag', icon('flag'));
  if (hasYear) end.append(html('div', 'sky', icon(goalIcon({ type: goal ?? 'flag', label: '' }))), el('div', 'btext', `Back to ${year}`));
  prog.append(el('div', 'plabel', 'Your progress'), el('div', 'ptrack'), end);
  card.append(tab, body, prog);
  root.append(card);
  const tCard = cue(scene, D, title, 0.2);
  m.pop(card, tCard, { from: 0.6 });
  m.pop(tab, tCard + 0.35, { from: 2 });
  m.pop(prog, tCard + 0.8, { from: 0.9 });
  if (hasYear) {
    const tBack = Math.max(tCard + 1.1, cue(scene, D, String(year), 0.55, tCard));
    m.pop(end, tBack, { from: 0.3 });
    m.loop(end, [{ rotate: '-3deg' }, { rotate: '3deg' }], { at: tBack + 0.6, dur: 1.4 });
  } else m.loop(end, [{ rotate: '-8deg' }, { rotate: '8deg' }], { at: tCard + 1.2, dur: 0.9 });
}
