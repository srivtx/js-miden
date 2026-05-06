import { describe, it, expect, beforeEach } from 'vitest';
import { stem, tokenize, tokenizeWithPositions } from '../../src/utils/tokenizer.js';

describe('Tokenizer', () => {
  describe('tokenize', () => {
    it('should split text into lowercase tokens', () => {
      const result = tokenize('Hello World');
      expect(result).toEqual(['hello', 'world']);
    });

    it('should remove punctuation', () => {
      const result = tokenize('Hello, world! How are you?');
      expect(result).toEqual(['hello', 'world', 'how', 'are', 'you']);
    });

    it('should filter out single-character tokens', () => {
      const result = tokenize('a b c def');
      expect(result).toEqual(['def']);
    });
  });

  describe('stem', () => {
    it('should stem "running" to "run"', () => {
      expect(stem('running')).toBe('run');
    });

    it('should stem "flies" to "fli"', () => {
      expect(stem('flies')).toBe('fli');
    });

    it('should stem "agreed" to "agre"', () => {
      expect(stem('agreed')).toBe('agre');
    });

    it('should handle short words', () => {
      expect(stem('a')).toBe('a');
      expect(stem('ab')).toBe('ab');
    });

    it('should lowercase input', () => {
      expect(stem('Running')).toBe('run');
    });
  });

  describe('tokenizeWithPositions', () => {
    it('should return tokens with positions and stem them', () => {
      const result = tokenizeWithPositions('running fast');
      expect(result).toEqual([
        { token: 'run', position: 0 },
        { token: 'fast', position: 1 },
      ]);
    });
  });
});
