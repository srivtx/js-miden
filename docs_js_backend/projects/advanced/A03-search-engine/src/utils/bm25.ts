import { BM25_PARAMS } from '../config/index.js';

export interface BM25Document {
  id: string;
  termFrequency: Map<string, number>;
  fieldLength: number;
}

export function calculateBM25Score(
  queryTerms: string[],
  doc: BM25Document,
  idfCache: Map<string, number>,
  avgFieldLength: number
): number {
  let score = 0;

  for (const term of queryTerms) {
    const tf = doc.termFrequency.get(term) || 0;
    if (tf === 0) continue;

    const idf = idfCache.get(term) || 0;
    const docLength = doc.fieldLength;

    const numerator = tf * (BM25_PARAMS.k1 + 1);
    const denominator = tf + BM25_PARAMS.k1 * (1 - BM25_PARAMS.b + BM25_PARAMS.b * (docLength / avgFieldLength));

    score += idf * (numerator / denominator);
  }

  return score;
}

export function calculateIDF(
  term: string,
  totalDocuments: number,
  documentFrequency: number
): number {
  // Smooth IDF: log((N - df + 0.5) / (df + 0.5) + 1)
  return Math.log(
    (totalDocuments - documentFrequency + 0.5) / (documentFrequency + 0.5) + 1
  );
}
