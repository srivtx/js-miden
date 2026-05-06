import { describe, it, expect } from 'vitest';
import { highlightText } from '../../src/utils/highlighter.js';

describe('Highlighter', () => {
  it('should highlight matching terms', () => {
    const text = 'This is a test. Another test here.';
    const highlights = highlightText(text, ['test']);

    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights[0]).toContain('<mark>test</mark>');
  });

  it('should handle multiple query terms', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const highlights = highlightText(text, ['quick', 'fox']);

    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights[0]).toContain('<mark>quick</mark>');
    expect(highlights[0]).toContain('<mark>fox</mark>');
  });

  it('should return empty array for no matches', () => {
    const text = 'Hello world';
    const highlights = highlightText(text, ['nonexistent']);
    expect(highlights).toEqual([]);
  });

  it('should limit to 3 highlights', () => {
    const text = 'Test one. Test two. Test three. Test four.';
    const highlights = highlightText(text, ['test']);
    expect(highlights.length).toBeLessThanOrEqual(3);
  });

  it('should be case insensitive', () => {
    const text = 'Hello World';
    const highlights = highlightText(text, ['world']);
    expect(highlights[0]).toContain('<mark>World</mark>');
  });
});
