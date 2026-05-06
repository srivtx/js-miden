# A03 Search Engine Backend - Data Models

## Document

The core entity representing a searchable document.

```typescript
interface Document {
  id: string;           // UUID v4
  title: string;        // 1-500 characters
  content: string;      // 1-50000 characters
  tags: string[];       // Optional categorization labels
  createdAt: Date;      // Indexing timestamp
  updatedAt: Date;      // Last modification timestamp
}
```

## InvertedIndexEntry

Internal representation of a term in the inverted index.

```typescript
interface InvertedIndexEntry {
  term: string;                    // Stemmed token
  documentFrequency: number;       // Number of docs containing term
  postings: Map<string, number[]>; // docId -> positions[]
}
```

### Postings List Structure

Each entry maps a document ID to an array of term positions:
- Title terms are weighted 2x (stored twice)
- Content terms are weighted 1x
- Positions enable phrase queries (future enhancement)

## SearchQuery

Parsed search request parameters.

```typescript
interface SearchQuery {
  q: string;           // Raw query string
  tags?: string[];     // Filter by tags
  dateFrom?: string;   // Filter by date range start
  dateTo?: string;     // Filter by date range end
  limit?: number;      // Page size
  offset?: number;     // Pagination offset
  highlight?: boolean; // Enable highlighting
}
```

## SearchResult

Individual search result with relevance scoring.

```typescript
interface SearchResult {
  document: Document;
  score: number;
  highlights?: Record<string, string[]>;
}
```

## SearchResponse

Complete search response envelope.

```typescript
interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: {
    tags: Array<{ value: string; count: number }>;
    dateRanges: Array<{ value: string; count: number }>;
  };
  query: string;
  took: number;  // Query time in milliseconds
}
```

## IndexStats

Index metadata and statistics.

```typescript
interface IndexStats {
  totalDocuments: number;
  totalTerms: number;
  averageDocumentLength: number;
}
```

## Storage Implementation

### DocumentStore
- In-memory `Map<string, Document>`
- Async operations with write queue
- Non-blocking reads

### InvertedIndex
- In-memory `Map<string, InvertedIndexEntry>`
- Stemmed terms as keys
- Copy-on-write update semantics
