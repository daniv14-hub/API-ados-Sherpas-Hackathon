// Cuts a persona Markdown into its "## " sections. Pure text handling, no interpretation.
export function personaSections(personaMd) {
  const sections = [];
  let current = null;
  for (const line of personaMd.split('\n')) {
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), lines: [line] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections.map((s) => ({ heading: s.heading, text: s.lines.join('\n').trim() }));
}
