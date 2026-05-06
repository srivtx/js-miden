/**
 * Highlight matching terms in document fields
 */

export function highlightText(text: string, queryTerms: string[]): string[] {
  const highlights: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    const hasMatch = queryTerms.some((term) => lowerSentence.includes(term.toLowerCase()));
    if (hasMatch) {
      let highlighted = sentence;
      for (const term of queryTerms) {
        const regex = new RegExp(`(\\b${escapeRegex(term)}\\b)`, 'gi');
        highlighted = highlighted.replace(regex, '<mark>$1</mark>');
      }
      highlights.push(highlighted);
    }
  }

  return highlights.slice(0, 3);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
