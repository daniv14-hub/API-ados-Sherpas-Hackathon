// Lists every piece of advice the family sees in Sherpas (handoff §2): S1, S2, S3.
// Item: { source: 'S1'|'S2'|'S3', field, index, text }. Real shapes (checked on all 4 cases): every narrative field
// is one string; bullets are lines starting with "- ", S3 fields hold one "**We should look into**: ..." line.

const S3_FH_FIELDS = ['retirement', 'assets', 'debt', 'savings'].map((a) => `${a}_what_to_look_into`);

// Markdown bullets ('- text') of a narrative field -> list of clean sentences.
function bullets(text) {
  if (typeof text !== 'string') return [];
  return text.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).replace(/\*\*/g, '').trim())
    .filter(Boolean);
}

function single(text) {
  return typeof text === 'string' && text.trim() ? text.replace(/\*\*/g, '').trim() : null;
}

export const adviceRef = (item) => `${item.source}:${item.field}:${item.index}`;

// Every piece of advice the family sees, from the three sources: S1 web app recommendations,
// S2 report recommendations (+ the allocation chart), S3 'We should look into' notes. Same fields in all cases.
export async function listAdvice(source, caseId) {
  const fh = await source.getPart(caseId, 'financial-health');
  const ia = await source.getPart(caseId, 'investment-analysis');
  const items = [];
  const addBullets = (src, field, text) => bullets(text).forEach((t, index) => items.push({ source: src, field, index, text: t }));

  addBullets('S1', 'summary_recommendations', fh.narrative?.summary_recommendations);
  addBullets('S2', 'recommendations_main', ia.narrative?.recommendations_main);
  if (ia.analysis?.summary?.assetAllocation) {
    items.push({ source: 'S2', field: 'assetAllocation', index: 0, text: 'Your current mix of stocks and bonds compared with the mix the plan recommends' });
  }
  addBullets('S2', 'recommendations_scenarios', ia.narrative?.recommendations_scenarios);
  for (const field of S3_FH_FIELDS) {
    const t = single(fh.narrative?.[field]);
    if (t) items.push({ source: 'S3', field, index: 0, text: t });
  }
  const also = single(ia.narrative?.portfolio_today_also_meaningful);
  if (also) items.push({ source: 'S3', field: 'portfolio_today_also_meaningful', index: 0, text: also });
  return items;
}
