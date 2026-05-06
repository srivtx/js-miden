/**
 * Document and search types for the search engine
 */

export interface Document {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexDocumentRequest {
  title: string;
  content: string;
  tags?: string[];
}

export interface SearchQuery {
  q: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  highlight?: boolean;
}

export interface SearchResult {
  document: Document;
  score: number;
  highlights?: Record<string, string[]>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: {
    tags: Array<{ value: string; count: number }>;
    dateRanges: Array<{ value: string; count: number }>;
  };
  query: string;
  took: number;
}

export interface InvertedIndexEntry {
  term: string;
  documentFrequency: number;
  postings: Map<string, number[]>; // documentId -> positions[]
}

export interface IndexStats {
  totalDocuments: number;
  totalTerms: number;
  averageDocumentLength: number;
}
