# A03 Search Engine Backend - Architecture

## System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│   Express    │────▶│   Controllers   │
│             │◀────│    Server    │◀────│                 │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                  │
                          ┌───────────────────────┘
                          ▼
                   ┌──────────────┐
                   │   Services   │
                   │  - Search    │
                   │  - Index     │
                   └──────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      ┌──────────────┐       ┌──────────────┐
      │ Inverted     │       │ Document     │
      │ Index        │       │ Store        │
      │ (O(1) lookup)│       │ (Queue-based)│
      └──────────────┘       └──────────────┘
```

## Component Responsibilities

### Controllers
- Handle HTTP requests/responses
- Input validation via middleware
- Route-specific rate limiting

### Services
- **SearchService**: Orchestrates search pipeline (query parsing → index lookup → scoring → highlighting)
- **IndexService**: Manages document lifecycle with non-blocking updates

### Models
- **DocumentStore**: In-memory document storage with queued writes
- **InvertedIndex**: Term-to-document mapping with copy-on-write semantics

### Utils
- **Tokenizer**: Text normalization, tokenization, and Porter stemming
- **BM25**: Relevance scoring algorithm
- **Highlighter**: Mark matching terms in result snippets

## Concurrency Model

The system uses an async queue pattern for writes:

1. Reads access data structures directly (no locks)
2. Writes are queued and processed via `setImmediate`
3. Multiple concurrent reads can proceed during a write

This prevents the bug where "updates block reads (table locked during indexing)".

## Data Flow

### Indexing Flow
1. Client POSTs document to `/documents`
2. `IndexController` validates input
3. `IndexService` saves to `DocumentStore`
4. `IndexService` updates `InvertedIndex`
5. Response returned to client

### Search Flow
1. Client GETs `/search?q=query`
2. `SearchController` parses query parameters
3. `SearchService` tokenizes and stems query
4. `InvertedIndex` retrieves matching documents (O(1) per term)
5. `SearchService` applies faceted filters
6. `SearchService` calculates BM25 scores
7. `Highlighter` generates snippets
8. Response returned with results, facets, and highlights
