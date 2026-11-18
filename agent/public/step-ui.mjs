// Draws the interactive blocks of a mission step (see step-logic.mjs for the data shapes and rules).
// Text only, never innerHTML with data. Plan figures are shown formatted, never computed.
import * as S from './step-logic.mjs';
import { formatFact } from './missions-logic.mjs';

// ctx: { h, data, mission, step, answers, people, set(i, who, value), redraw(), ready(), copy(text, note), openSherpy() }
export function renderBlocks(ctx) {
  const { step } = ctx;
  const out = (step.ui ?? []).map((b, i) => {
    const r = RENDER[b.kind];
    return r ? ctx.h('div', { class: `blk blk-${b.kind}` }, b.title && ctx.h('h4', { class: 'blk-title' }, b.title), r(ctx, b, i)) : null;
  });
  if (step.type === 'learn') out.push(ctx.h('button', { type: 'button', class: 'pill ask', onclick: () => ctx.openSherpy() }, 'Ask Sherpy about this'));
  return out;
}

const cur = (ctx, i, who) => ctx.answers?.[ctx.step.id]?.[i]?.[who] ?? {};
const nameOf = (who) => (who === S.TOGETHER ? null : who);

function factText(mission, key) {
  const f = S.factOf(mission, key);
  return f ? formatFact(f) : '';
}

function copyBtn(ctx, text, aria) {
  const note = ctx.h('span', { class: 'copied', role: 'status' });
  return ctx.h('span', { class: 'copywrap' }, ctx.h('button', { type: 'button', class: 'pill small', 'aria-label': aria, onclick: () => {
    ctx.copy(text, (m) => { note.textContent = m; });
  } }, 'Copy'), note);
}

// One renderer per block kind. Each gets ctx (data, answers, set/redraw/ready callbacks) and the block spec
// from the missions JSON, and returns DOM nodes built with text only (no innerHTML with data).
const RENDER = {
  // The plan's own advice for this topic, word for word (generated missions).
  quotes(ctx, b) {
    const { h } = ctx;
    if (!b.items?.length) return null;
    return h('div', { class: 'quotes' }, h('p', { class: 'qhead' }, 'What your plan says'),
      h('ul', null, b.items.map((t) => h('li', null, t))));
  },

  bars(ctx, b) {
    const { h, mission } = ctx;
    const val = (k) => Number(S.factOf(mission, k)?.value);
    const max = Math.max(...b.rows.flatMap((r) => [val(r.fact), r.ref ? val(r.ref) : 0]).filter(Number.isFinite), 1);
    return h('div', { class: 'bars' }, b.rows.map((r) => {
      const v = val(r.fact);
      const fill = h('i');
      fill.style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
      const track = h('div', { class: 'track', 'aria-hidden': 'true' }, fill);
      if (r.ref) {
        const tick = h('b', { class: 'tick' });
        tick.style.left = `${Math.min(100, (val(r.ref) / max) * 100)}%`;
        track.append(tick);
      }
      return h('div', { class: 'barrow' },
        h('div', { class: 'barlabel' }, h('span', null, r.label), h('strong', null, factText(mission, r.fact))),
        track,
        r.ref && h('div', { class: 'barref' }, h('span', { class: 'tickkey', 'aria-hidden': 'true' }), `${r.refLabel}: `, h('strong', null, factText(mission, r.ref))));
    }));
  },

  fields(ctx, b, i) {
    const { h } = ctx;
    return S.whoFor(ctx.step, b, ctx.people).map((who) => {
      const a = cur(ctx, i, who);
      return h('fieldset', { class: 'fields' }, nameOf(who) && h('legend', null, who),
        b.fields.map((f) => {
          const id = `f-${ctx.step.id}-${i}-${who}-${f.key}`;
          const v = a[f.key];
          const input = h('input', { id, type: 'text', autocomplete: 'off', inputmode: f.kind === 'usd' ? 'numeric' : null, placeholder: f.kind === 'usd' ? '$' : '' });
          input.value = v == null ? '' : f.kind === 'usd' ? S.money(v) : String(v);
          input.addEventListener('input', () => {
            const raw = input.value;
            const next = { ...cur(ctx, i, who), [f.key]: f.kind === 'usd' ? S.parseUsd(raw) : raw.slice(0, 200) };
            if (next[f.key] == null || next[f.key] === '') delete next[f.key];
            ctx.set(i, who, next);
            ctx.ready();
          });
          if (f.kind === 'usd') input.addEventListener('blur', () => { const n = cur(ctx, i, who)[f.key]; if (typeof n === 'number') input.value = S.money(n); });
          return h('div', { class: 'field' }, h('label', { for: id }, f.label, b.optional ? h('span', { class: 'opt' }, ' optional') : null), input);
        }));
    });
  },

  checklist(ctx, b, i) {
    const { h, mission } = ctx;
    const a = cur(ctx, i, S.TOGETHER);
    return h('ul', { class: 'checks' }, b.items.map((it, j) => {
      const id = `c-${ctx.step.id}-${i}-${j}`;
      const box = h('input', { type: 'checkbox', id });
      box.checked = a[j] === true;
      box.addEventListener('change', () => { ctx.set(i, S.TOGETHER, { ...cur(ctx, i, S.TOGETHER), [j]: box.checked }); ctx.ready(); });
      return h('li', null, box, h('label', { for: id }, S.fillFacts(it.text, mission)),
        it.copy && copyBtn(ctx, S.fillFacts(it.copy, mission), `Copy ${S.fillFacts(it.copy, mission)}`));
    }));
  },

  email(ctx, b, i) {
    const { h } = ctx;
    return S.whoFor(ctx.step, b, ctx.people).map((who) => {
      const name = nameOf(who) ?? '';
      const text = b.template.replace('{name}', name).replace(/\s*\{name\}/, '');
      const a = cur(ctx, i, who);
      const mail = `mailto:?subject=${encodeURIComponent(b.subject ?? '')}&body=${encodeURIComponent(text)}`;
      return h('div', { class: 'email' }, name && h('h5', null, `${name}'s email`),
        h('pre', { class: 'mail', tabindex: '0' }, text),
        h('div', { class: 'row' }, copyBtn(ctx, text, `Copy ${name} email`), h('a', { class: 'pill small', href: mail }, 'Open in my email app')),
        h('p', { class: 'fine' }, 'When HR answers, tap what they said:'),
        (b.questions ?? []).map((q) => h('div', { class: 'q', role: 'radiogroup', 'aria-label': `${name} ${q.label}` }, h('span', { class: 'qlabel' }, q.label),
          h('div', { class: 'opts' }, ['Yes', 'No', 'Not sure'].map((opt) => h('button', { type: 'button', role: 'radio', class: `opt-btn ${a[q.key] === opt ? 'on' : ''}`, 'aria-checked': String(a[q.key] === opt),
            onclick: () => { ctx.set(i, who, { ...cur(ctx, i, who), [q.key]: opt }); ctx.redraw(); } }, opt))))));
    });
  },

  rank(ctx, b, i) {
    const { h } = ctx;
    return h('div', { class: 'ranks' }, S.whoFor(ctx.step, b, ctx.people).map((who) => {
      const a = cur(ctx, i, who);
      const order = validOrder(a.order, b.items);
      const save = (next, saved) => { ctx.set(i, who, { order: next, saved }); ctx.redraw(); };
      return h('div', { class: 'rank' }, nameOf(who) && h('h5', null, `${who}'s order`),
        rankList(ctx, b.items, order, (next) => save(next, false), nameOf(who) ?? 'your'),
        a.saved ? h('p', { class: 'saved' }, '✓ Order saved') : h('button', { type: 'button', class: 'pill primary small', onclick: () => save(order, true) }, nameOf(who) ? `This is ${who}'s order` : 'This is my order'));
    }));
  },

  agree(ctx, b, i) {
    const { h, data } = ctx;
    const rankStep = data.missions.flatMap((m) => m.steps).find((s) => s.id === b.rankStep);
    const ri = (rankStep?.ui ?? []).findIndex((x) => x.kind === 'rank');
    const items = rankStep?.ui?.[ri]?.items ?? [];
    const label = (k) => items.find((x) => x.key === k)?.label ?? k;
    const a = cur(ctx, i, S.TOGETHER);
    const who = S.whoFor(rankStep, rankStep.ui[ri], ctx.people);
    const theirs = who.map((w) => ({ w, order: validOrder(ctx.answers?.[b.rankStep]?.[ri]?.[w]?.order, items) }));
    const order = validOrder(a.order ?? theirs[0]?.order, items);
    const amounts = { ...(a.amounts ?? {}) };
    const total = h('strong');
    const showTotal = () => { total.textContent = S.money(S.sumAmounts(amounts)); };
    showTotal();
    const write = (patch) => ctx.set(i, S.TOGETHER, { order, amounts, saved: false, ...patch });
    return h('div', null,
      theirs.length > 1 && h('div', { class: 'compare' }, theirs.map(({ w, order: o }) => h('div', { class: 'theirs' }, h('h5', null, w),
        h('ol', null, o.map((k) => h('li', null, label(k))))))),
      h('h5', null, 'Your shared order, and how much a year for each (optional)'),
      rankList(ctx, items, order, (next) => { write({ order: next }); ctx.redraw(); }, 'shared', (k) => {
        const id = `a-${ctx.step.id}-${k}`;
        const input = h('input', { id, type: 'text', inputmode: 'numeric', placeholder: '$ a year', 'aria-label': `${label(k)}: amount a year` });
        if (typeof amounts[k] === 'number') input.value = S.money(amounts[k]);
        input.addEventListener('input', () => { const n = S.parseUsd(input.value); if (n == null) delete amounts[k]; else amounts[k] = n; write({}); showTotal(); ctx.ready(); });
        input.addEventListener('blur', () => { if (typeof amounts[k] === 'number') input.value = S.money(amounts[k]); });
        return input;
      }),
      h('p', { class: 'total' }, 'Your total: ', total, ' a year · Free cash flow in your plan: ', h('strong', null, factText(ctx.mission, b.total)), ' a year'),
      a.saved ? h('p', { class: 'saved' }, '✓ Saved. You can still change it.') : h('button', { type: 'button', class: 'pill primary small', onclick: () => { write({ saved: true }); ctx.redraw(); } }, 'Save our order'));
  },

  choice(ctx, b, i) {
    const { h, mission } = ctx;
    const a = cur(ctx, i, S.TOGETHER);
    const pick = (p) => { ctx.set(i, S.TOGETHER, { ...cur(ctx, i, S.TOGETHER), pick: p }); ctx.redraw(); };
    const amount = h('input', { type: 'text', inputmode: 'numeric', placeholder: '$ a month', 'aria-label': 'New monthly payment' });
    if (typeof a.amount === 'number') amount.value = S.money(a.amount);
    amount.addEventListener('input', () => { const n = S.parseUsd(amount.value); const next = { ...cur(ctx, i, S.TOGETHER), pick: 'more' }; if (n == null) delete next.amount; else next.amount = n; ctx.set(i, S.TOGETHER, next); ctx.ready(); });
    return h('div', { class: 'choice', role: 'radiogroup', 'aria-label': 'Monthly payment' },
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(a.pick === 'keep'), class: `opt-card ${a.pick === 'keep' ? 'on' : ''}`, onclick: () => pick('keep') },
        'Keep the current payment: ', h('strong', null, `${factText(mission, b.keep)} a month`)),
      h('div', { class: `opt-card ${a.pick === 'more' ? 'on' : ''}` },
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(a.pick === 'more'), class: 'linkish', onclick: () => pick('more') }, 'Pay more each month'),
        a.pick === 'more' && amount));
  },

  agreed(ctx, b) {
    const { h, data } = ctx;
    const n = S.agreedAmount(data, ctx.answers, b.need);
    const decision = data.missions.find((m) => m.steps.some((s) => (s.ui ?? []).some((x) => x.kind === 'agree')));
    return h('p', { class: 'agreed' }, n != null
      ? ['In the cash flow decision you agreed ', h('strong', null, `${S.money(n)} a year`), ` ${b.label}.`]
      : [`You didn't set an amount ${b.label} in the cash flow decision${decision ? ` ("${decision.title}")` : ''}. You can still choose one here.`]);
  },

  recall(ctx, b) {
    const { h, data } = ctx;
    const src = data.missions.flatMap((m) => m.steps).find((s) => s.id === b.step);
    const lines = [];
    (src?.ui ?? []).forEach((blk, i) => {
      for (const who of S.whoFor(src, blk, ctx.people)) {
        const a = ctx.answers?.[src.id]?.[i]?.[who] ?? {};
        const pre = nameOf(who) ? `${who}: ` : '';
        if (blk.kind === 'fields') {
          for (const f of blk.fields) if (a[f.key] != null && a[f.key] !== '') lines.push(`${pre}${f.label}: ${f.kind === 'usd' ? S.money(a[f.key]) : a[f.key]}`);
        } else if (blk.kind === 'email') {
          for (const q of blk.questions ?? []) if ((!b.keys || b.keys.includes(q.key)) && a[q.key]) lines.push(`${pre}${q.label} ${a[q.key]}`);
        } else if (blk.kind === 'choice' && a.pick) {
          lines.push(a.pick === 'keep' ? `Keep the current payment: ${factText(data.missions.find((m) => m.steps.includes(src)), blk.keep)} a month`
            : typeof a.amount === 'number' ? `New monthly payment: ${S.money(a.amount)}` : 'Pay more each month (no amount yet)');
        }
      }
    });
    return lines.length ? h('ul', { class: 'recall' }, lines.map((l) => h('li', null, l))) : h('p', { class: 'fine' }, 'Nothing written down in that step yet.');
  },
};

function validOrder(order, items) {
  const keys = items.map((x) => x.key);
  const kept = (Array.isArray(order) ? order : []).filter((k, i, a) => keys.includes(k) && a.indexOf(k) === i);
  return [...kept, ...keys.filter((k) => !kept.includes(k))];
}

// An ordered list with ↑ ↓ buttons. extra(key) adds something to the row (an amount input).
function rankList(ctx, items, order, onMove, whose, extra) {
  const { h, mission } = ctx;
  const move = (from, to) => { const next = [...order]; const [k] = next.splice(from, 1); next.splice(to, 0, k); onMove(next); };
  return h('ol', { class: 'ranklist' }, order.map((k, idx) => {
    const it = items.find((x) => x.key === k);
    const fact = it.fact ? `${factText(mission, it.fact)} ${it.factLabel ?? ''}`.trim() : it.note;
    return h('li', null, h('span', { class: 'pos', 'aria-hidden': 'true' }, String(idx + 1)),
      h('span', { class: 'what' }, h('span', null, it.label), fact && h('small', null, fact)),
      extra && extra(k),
      h('span', { class: 'moves' },
        h('button', { type: 'button', class: 'mv', disabled: idx === 0, 'aria-label': `Move ${it.label} up in ${whose} order`, onclick: () => move(idx, idx - 1) }, '↑'),
        h('button', { type: 'button', class: 'mv', disabled: idx === order.length - 1, 'aria-label': `Move ${it.label} down in ${whose} order`, onclick: () => move(idx, idx + 1) }, '↓')));
  }));
}
