/**
 * Search Service - orchestrates full-text search with BM25 scoring,
 * faceted filtering, and highlighting
 */

import { Document, SearchQuery, SearchResult, SearchResponse, IndexStats } from '../types/index.js';
import { DocumentStore } from '../models/documentStore.js';
import { InvertedIndex } from '../models/invertedIndex.js';
import { tokenize, stem } from '../utils/tokenizer.js';
import { calculateBM25Score, calculateIDF } from '../utils/bm25.js';
import { highlightText } from '../utils/highlighter.js';

export class SearchService {
  constructor(
    private documentStore: DocumentStore,
    private invertedIndex: InvertedIndex
  ) {}

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    const queryTerms = tokenize(query.q);
    if (queryTerms.length === 0) {
      return {
        results: [],
        total: 0,
        facets: { tags: [], dateRanges: [] },
        query: query.q,
        took: Date.now() - startTime,
      };
    }

    const stemmedTerms = queryTerms.map(stem);

    // Get postings from inverted index (O(1) per term)
    const indexEntries = await this.invertedIndex.searchTerms(stemmedTerms);

    // Aggregate candidate document IDs
    const candidateScores = new Map<string, number>();
    const stats = await this.getStats();

    for (const [term, entry] of indexEntries) {
      const idf = calculateIDF(term, stats.totalDocuments, entry.documentFrequency);

      for (const [docId, positions] of entry.postings) {
        const currentScore = candidateScores.get(docId) || 0;
        // Simple TF scoring for candidates
        const tf = positions.length;
        candidateScores.set(docId, currentScore + idf * tf);
      }
    }

    // Fetch documents and apply faceted filters
    let candidateIds = Array.from(candidateScores.keys());
    const allDocs = await this.documentStore.getByIds(candidateIds);

    let filteredDocs = allDocs;

    // Tag filter
    if (query.tags && query.tags.length > 0) {
      filteredDocs = filteredDocs.filter((doc) =>
        query.tags!.some((tag) => doc.tags.includes(tag))
      );
    }

    // Date range filter
    if (query.dateFrom || query.dateTo) {
      const from = query.dateFrom ? new Date(query.dateFrom) : null;
      const to = query.dateTo ? new Date(query.dateTo) : null;
      filteredDocs = filteredDocs.filter((doc) => {
        const createdAt = new Date(doc.createdAt);
        if (from && createdAt < from) return false;
        if (to && createdAt > to) return false;
        return true;
      });
    }

    // Calculate precise BM25 scores
    const results: SearchResult[] = [];
    const avgDocLength = stats.averageDocumentLength || 1;
    const idfCache = new Map<string, number>();

    for (const [term, entry] of indexEntries) {
      idfCache.set(term, calculateIDF(term, stats.totalDocuments, entry.documentFrequency));
    }

    for (const doc of filteredDocs) {
      const termFrequency = new Map<string, number>();
      for (const [term, entry] of indexEntries) {
        const positions = entry.postings.get(doc.id);
        if (positions) {
          termFrequency.set(term, positions.length);
        }
      }

      const score = calculateBM25Score(
        stemmedTerms,
        { id: doc.id, termFrequency, fieldLength: doc.content.length + doc.title.length },
        idfCache,
        avgDocLength
      );

      const result: SearchResult = { document: doc, score };

      if (query.highlight) {
        const titleHighlights = highlightText(doc.title, queryTerms);
        const contentHighlights = highlightText(doc.content, queryTerms);
        result.highlights = {};
        if (titleHighlights.length > 0) result.highlights.title = titleHighlights;
        if (contentHighlights.length > 0) result.highlights.content = contentHighlights;
      }

      results.push(result);
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    // Calculate facets
    const facets = await this.calculateFacets(filteredDocs);

    return {
      results: paginatedResults,
      total,
      facets,
      query: query.q,
      took: Date.now() - startTime,
    };
  }

  async getStats(): Promise<IndexStats> {
    const totalDocuments = await this.documentStore.count();
    const totalTerms = (await this.invertedIndex.getStats()).totalTerms;

    let totalLength = 0;
    const allDocs = await this.documentStore.getAll();
    for (const doc of allDocs) {
      totalLength += doc.title.length + doc.content.length;
    }

    return {
      totalDocuments,
      totalTerms,
      averageDocumentLength: totalDocuments > 0 ? totalLength / totalDocuments : 0,
    };
  }

  private async calculateFacets(docs: Document[]): Promise<SearchResponse['facets']> {
    const tagCounts = new Map<string, number>();
    const dateRangeCounts = new Map<string, number>();

    for (const doc of docs) {
      for (const tag of doc.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }

      const year = new Date(doc.createdAt).getFullYear().toString();
      dateRangeCounts.set(year, (dateRangeCounts.get(year) || 0) + 1);
    }

    return {
      tags: Array.from(tagCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      dateRanges: Array.from(dateRangeCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => parseInt(b.value) - parseInt(a.value)),
    };
  }
}
