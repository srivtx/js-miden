export interface Document {
  id: number;
  title: string;
  content: string;
  tsvector: string;
  created_at: Date;
}

export interface SearchResult {
  id: number;
  title: string;
  content: string;
  rank: number;
  highlights: string[];
}

export interface IndexRequest {
  title: string;
  content: string;
}

export interface SearchRequest {
  q: string;
  page?: string;
  limit?: string;
}
