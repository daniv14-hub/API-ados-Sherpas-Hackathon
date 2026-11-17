import { fillLine, styleOf } from './scenes.mjs';
import { extractMentions, isGrounded } from '../numbers.mjs';

// The model writes wording only. Numbers reach the text through {placeholders} that we fill from
// facts, and every line is checked before use; anything doubtful falls back to the scene template.

const noDigits = (v) => JSON.parse(JSON.stringify(v ?? null), (_, x) => (typeof x === 'number' ? undefined : typeof x === 'string' ? x.replace(/\d+/g, '') : x));
const wordCount = (t) => t.split(/\s+/).filter(Boolean).length;

const STYLE_RULE = {
  analytical: 'analytical: lead with the number, then what it means.',
  emotional: 'emotional: lead with what it means for the family, then the number.',
  mixed: 'mixed: give both the number and what it means for the family.',
};

const SYSTEM = `You are Sherpy, the warm mascot of Sherpas Wealth, narrating a short personal video to a family.
Write plain, friendly English, speak to the family as "you", use short sentences.
Write exactly one line per scene, in the order given, each with at most maxWords words.
NEVER write digits or numerals. Put every figure in by using only the {placeholders} listed for that scene, written with curly braces.
Do not invent facts. Reply with JSON only: {"lines": ["...", "..."]}.`;

function sceneBrief(s, style) {
  return { id: s.id, style: STYLE_RULE[style], maxWords: s.maxWords, placeholders: Object.keys(s.values), about: noDigits(s.props) };
}

// Returns the filled model line, or null when it breaks any rule.
function accept(scene, raw, numberSet) {
  try {
    if (typeof raw !== 'string' || /\d/.test(raw)) return null;
    const keys = [...raw.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (keys.some((k) => !(k in scene.values))) return null;
    const filled = fillLine(raw, scene.values);
    if (/[{}]/.test(filled.text)) return null;
    if (wordCount(filled.text) > scene.maxWords) return null;
    if (!extractMentions(filled.text).every((m) => isGrounded(m, numberSet))) return null;
    return { id: scene.id, ...filled, source: 'model' };
  } catch { return null; }
}

const templateLine = (s) => ({ id: s.id, ...fillLine(s.template, s.values), source: 'template' });

const unfence = (t) => String(t).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

export async function narrate(scenes, { complete, numberSet, profile, log = console }) {
  try {
    const names = profile?.present?.length ? profile.present : Object.keys(profile?.people ?? {});
    const style = styleOf(names, profile ?? {});
    const user = `Scenes:\n${JSON.stringify(scenes.map((s) => sceneBrief(s, style)), null, 1)}`;
    const reply = await complete([{ role: 'system', content: SYSTEM }, { role: 'user', content: user }]);
    const lines = JSON.parse(unfence(reply))?.lines;
    if (!Array.isArray(lines) || lines.length !== scenes.length) throw new Error('reply has no matching lines array');
    return scenes.map((s, i) => accept(s, lines[i], numberSet) ?? templateLine(s));
  } catch (e) {
    log.warn(`narration fell back to templates: ${e?.message ?? e}`);
    return scenes.map(templateLine);
  }
}

export function chatComplete({ baseUrl, key }) {
  return async (messages) => {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-5-mini', messages }),
    });
    if (!res.ok) throw new Error(`chat completion failed: HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  };
}
