import { describe, it, expect } from 'vitest';
import { calculateBM25Score, calculateIDF } from '../../src/utils/bm25.js';

describe('BM25', () => {
  describe('calculateIDF', () => {
    it('should calculate IDF for common terms', () => {
      const idf = calculateIDF('test', 100, 50);
      expect(idf).toBeGreaterThan(0);
      expect(idf).toBeLessThan(1);
    });

    it('should calculate higher IDF for rare terms', () => {
      const commonIdf = calculateIDF('common', 100, 50);
      const rareIdf = calculateIDF('rare', 100, 1);
      expect(rareIdf).toBeGreaterThan(commonIdf);
    });
  });

  describe('calculateBM25Score', () => {
    it('should score documents with matching terms higher', () => {
      const tf = new Map([['test', 5]]);
      const doc = {
        id: '1',
        termFrequency: tf,
        fieldLength: 100,
      };
      const idfCache = new Map([['test', 1.5]]);

      const score = calculateBM25Score(['test'], doc, idfCache, 100);
      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 for no matching terms', () => {
      const tf = new Map();
      const doc = {
        id: '1',
        termFrequency: tf,
        fieldLength: 100,
      };
      const idfCache = new Map([['test', 1.5]]);

      const score = calculateBM25Score(['test'], doc, idfCache, 100);
      expect(score).toBe(0);
    });

    it('should penalize longer documents', () => {
      const idfCache = new Map([['test', 1.5]]);

      const shortDoc = {
        id: '1',
        termFrequency: new Map([['test', 3]]),
        fieldLength: 50,
      };

      const longDoc = {
        id: '2',
        termFrequency: new Map([['test', 3]]),
        fieldLength: 500,
      };

      const shortScore = calculateBM25Score(['test'], shortDoc, idfCache, 100);
      const longScore = calculateBM25Score(['test'], longDoc, idfCache, 100);

      expect(shortScore).toBeGreaterThan(longScore);
    });
  });
});
