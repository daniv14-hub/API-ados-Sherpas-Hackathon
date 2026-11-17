// The five scenes of the explainer video, in the Sherpas sticker look (D10).
// Contract: renderScene(stageEl, scene, { reducedMotion }) -> { at(t), dispose() }; t = seconds inside the scene.
// Every number on screen is a value from scene.props (bars may be proportional; labels are the data values).
import { estimateDuration } from './video-time.mjs';
import { money, el, html, motion, cue, icon, goalIcon, topicIcon, moveIcon, sherpy, preloadSherpy } from './video-shapes.mjs';

const SCENES = { goals, standing, worry, act, mission };

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

function decor(root) {
  root.append(el('div', 'blob b1'), el('div', 'blob b2'));
}

// ---------------------------------------------------------------- 1. goals

function goalCard(g, main) {
  const card = el('div', `card goal${main ? ' main' : ''}`);
  const college = g.type === 'college' && /^college\s+/i.test(g.label ?? '');
  const title = college ? g.label.replace(/^college\s+/i, '') : g.type === 'vacation' ? 'Vacation' : g.label;
  card.append(html('div', 'disc', icon(goalIcon(g))));
  if (college) card.append(el('div', 'sub', 'College'));
  card.append(el('div', 'title', title));
  if (g.amount !== null && g.amount !== undefined) {
    card.append(el('div', 'amount', money(g.amount)));
    if (g.type === 'vacation') card.append(el('div', 'sub', 'every year'));
  }
  if (g.year) card.append(el('div', 'chip', g.type === 'vacation' ? `from ${g.year}` : String(g.year)));
  if (main) card.append(el('div', 'stamp small tone-brand corner', 'Main goal'));
  return card;
}

function goals(root, { people = [], goals: list = [] }, { m, D }) {
  decor(root);
  root.classList.add(list.length > 4 ? 'many' : 'few');
  headline(root, ['Your ', ['goals']], m, 0);
  const kicker = el('div', 'kicker', names(people));
  root.append(kicker);
  m.pop(kicker, 0.15);

  // Sherpy greets and waves, then slides out by 35 % of the scene.
  const s = sherpy({ arm: true });
  s.wrap.classList.add('greet');
  const bubble = el('div', 'bubble', `Hi, ${names(people)}!`);
  root.append(s.wrap, bubble);
  const leave = 0.35 * D;
  m.pop(s.wrap, 0.05 * D, { from: 0.3 });
  m.bob(s.rig, 0.6, { dy: 6 });
  m.pop(bubble, 0.12 * D);
  if (!m.reduced) m.play(s.arm, [{ rotate: '-14deg' }, { rotate: '16deg' }], { at: 0.12 * D, dur: 0.32, easing: 'ease-in-out', iterations: 6, direction: 'alternate' });
  m.out(s.wrap, leave - 0.5, { x: -1000 });
  m.play(bubble, [{ opacity: 1 }, { opacity: 0 }], { at: leave - 0.6, dur: 0.2, fill: 'forwards' });

  // The main goal leads (planScenes orders it first): every goal of that type is drawn big.
  const row = el('div', 'goals-row');
  const mainType = list[0]?.type;
  const step = Math.min(0.5, (0.75 * D - leave) / Math.max(1, list.length));
  list.forEach((g, i) => {
    const card = goalCard(g, g.type === mainType);
    card.style.rotate = `${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg`;
    row.append(card);
    m.pop(card, leave + i * step);
    m.bob(card, leave + i * step + 0.6, { dy: 5, dur: 2 + (i % 3) * 0.3 });
  });
  root.append(row);
}

// ---------------------------------------------------------------- 2. standing

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

function standing(root, { score, band, colour, weakest, pillars }, { m, scene, D }) {
  decor(root);
  headline(root, ['Where you ', ['stand']], m, 0);
  const d = dial(score, colour);
  root.append(d.box);
  m.pop(d.box, 0.04 * D, { from: 0.6 });
  const tScore = cue(scene, D, String(score), 0.15);
  m.tween(Math.min(tScore, 0.12 * D), Math.max(0.6, tScore + 0.5 - Math.min(tScore, 0.12 * D)), d.set);
  d.set(0);

  const stamp = el('div', `stamp band ${tone(colour)}`, band);
  root.append(stamp);
  m.pop(stamp, Math.max(tScore + 0.6, cue(scene, D, band, 0.4)), { from: 2 });

  const tWeak = Math.max(tScore + 0.9, cue(scene, D, weakest?.name, 0.5));
  if (pillars?.length) {
    const list = el('div', 'pillars');
    pillars.forEach((p, i) => {
      const weak = p.name === weakest?.name;
      const row = el('div', `pillar${weak ? ' weak' : ''}`);
      const fill = el('div', 'fill');
      const track = el('div', 'track');
      track.append(fill);
      row.append(el('div', 'name', p.name), track, el('div', 'pts', p.points));
      if (weak) {
        const st = el('div', 'stamp small tone-red', 'Weakest');
        row.append(st);
        m.pop(st, tWeak + 0.2, { from: 2 });
      }
      list.append(row);
      const at = 0.3 * D + i * 0.18;
      m.pop(row, Math.min(at, tWeak - 0.2), { from: 0.8 });
      m.tween(Math.min(at, tWeak - 0.2) + 0.1, 0.6, (k) => { fill.style.width = `${p.score * k}%`; });
    });
    root.append(list);
  } else if (weakest) {
    const card = el('div', 'card weakest');
    card.append(el('div', 'label', 'Weakest area'), el('div', 'name', weakest.name), el('div', 'pts', weakest.points),
      el('div', 'stamp tone-red corner', 'Needs care'));
    root.append(card);
    m.pop(card, tWeak);
  }
}

// ---------------------------------------------------------------- 3. worry

function worry(root, { gap }, { m, scene, D }) {
  decor(root);
  if (!gap) return;
  headline(root, ['The ', [gap.label], ' gap'], m, 0);
  const badge = html('div', 'disc topic', icon(topicIcon(gap.topic)));
  root.append(badge);
  m.pop(badge, 0.1 * D);
  m.loop(badge, [{ rotate: '-6deg' }, { rotate: '6deg' }], { at: 0.1 * D + 0.5, dur: 1.6 });

  const hasHave = typeof gap.have === 'number' && gap.have > 0;
  const haveShare = hasHave ? gap.have / (gap.have + gap.gap) : 0; // widths only; never shown as a number
  const bar = el('div', 'gapbar');
  const have = el('div', 'seg have');
  const miss = el('div', 'seg miss');
  bar.append(have, miss);
  root.append(bar);
  m.pop(bar, 0.12 * D, { from: 0.9 });

  const tHave = 0.2 * D;
  const tGap = Math.max(tHave + 0.8, cue(scene, D, money(gap.gap), 0.45));
  have.style.width = '0%'; miss.style.width = '0%'; miss.style.left = `${haveShare * 100}%`;
  if (hasHave) m.tween(tHave, 0.6, (k) => { have.style.width = `${haveShare * 100 * k}%`; });
  m.tween(tGap, 0.8, (k) => { miss.style.width = `${(1 - haveShare) * 100 * k}%`; });

  if (hasHave) {
    const lab = el('div', 'gaplabel have-l');
    lab.append(el('div', 'amt', money(gap.have)), el('div', 'what', gap.haveLabel ?? ''));
    root.append(lab);
    m.pop(lab, tHave + 0.4);
  }
  const lab = el('div', 'gaplabel miss-l');
  lab.append(el('div', 'amt', money(gap.gap)), el('div', 'what', gap.gapLabel ?? ''));
  root.append(lab);
  m.pop(lab, tGap + 0.5);
}

// ---------------------------------------------------------------- 4. act

function chips(before, after) {
  const box = el('div', 'chips');
  box.append(el('span', 'chip before', before), el('span', 'to', '→'), el('span', `chip after${after > before ? ' up' : ''}`, after));
  return box;
}

function act(root, { moves = [], combined = null, before }, { m, scene, D }) {
  decor(root);
  root.classList.toggle('solo', !combined);
  headline(root, ['If you ', ['act']], m, 0);
  const list = el('div', 'moves');
  const step = Math.min(0.9, (0.45 * D) / Math.max(1, moves.length));
  moves.forEach((mv, i) => {
    const card = el('div', 'card move');
    card.append(html('div', 'disc', icon(moveIcon(mv.title))), el('div', 'title', mv.title), chips(mv.before, mv.after));
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
  const tBox = Math.max(0.08 * D + moves.length * step, cue(scene, D, String(before), 0.55) - 0.3);
  m.pop(box, tBox);
  const tAfter = Math.max(tBox + 0.5, cue(scene, D, String(combined.after), 0.7));
  m.tween(tBox + 0.4, Math.max(0.6, tAfter - tBox), (k) => { num.textContent = String(Math.round(before + (combined.after - before) * k)); });
  if (!m.reduced) m.play(num, [{ scale: '1' }, { scale: '1.25' }, { scale: '1' }], { at: tAfter + 0.1, dur: 0.5 });
}

// ---------------------------------------------------------------- 5. mission

function mission(root, { mission: title }, { m, scene, D }) {
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
  prog.append(el('div', 'plabel', 'Your progress'), el('div', 'ptrack'), html('div', 'pflag', icon('flag')));
  card.append(tab, body, prog);
  root.append(card);
  const tCard = cue(scene, D, title, 0.2);
  m.pop(card, tCard, { from: 0.6 });
  m.pop(tab, tCard + 0.35, { from: 2 });
  m.pop(prog, tCard + 0.8, { from: 0.9 });
  m.loop(prog.querySelector('.pflag'), [{ rotate: '-8deg' }, { rotate: '8deg' }], { at: tCard + 1.2, dur: 0.9 });
}
