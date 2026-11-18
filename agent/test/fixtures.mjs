// Test helpers: loads the four cases from cases/ (financial-health, investment-analysis, persona).
import { readFileSync } from 'node:fs';

export const CASES = ['timothy-melanie-weah', 'michael-carter', 'daniel-emily-johnson', 'samantha-lewis'];

export function loadCase(id) {
  const dir = new URL(`../../cases/${id}/`, import.meta.url);
  return {
    fh: JSON.parse(readFileSync(new URL('financial-health.json', dir), 'utf8')),
    personaMd: readFileSync(new URL('persona.md', dir), 'utf8'),
    ia: JSON.parse(readFileSync(new URL('investment-analysis.json', dir), 'utf8')),
  };
}
