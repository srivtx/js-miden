# A03 Search Engine Backend - Overview

## Project Description

A03 is a mini Elasticsearch-like search backend built with Express 5, TypeScript, and ESM. It provides full-text search capabilities with relevance scoring (BM25), faceted search, and term highlighting.

## Key Features

- **Full-Text Search**: Tokenization, stemming, and BM25 relevance scoring
- **Inverted Index**: O(1) term lookup for efficient searching
- **Faceted Search**: Filter by tags and date ranges
- **Highlighting**: Mark matching terms in search results
- **Non-Blocking Indexing**: Concurrent reads during document updates

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Language**: TypeScript (ESM)
- **Testing**: Vitest + Supertest
- **Validation**: Zod

## Quick Start

```bash
npm install
npm run dev
```

## API Endpoints

- `GET /health` - Health check
- `GET /search?q=query` - Search documents
- `POST /documents` - Index a new document
- `GET /documents` - List documents
- `GET /documents/:id` - Get a document
- `PATCH /documents/:id` - Update a document
- `DELETE /documents/:id` - Delete a document
- `GET /stats` - Index statistics

## Design Principles

1. **Performance**: Uses inverted index for sub-100ms search queries
2. **Correctness**: Stemming ensures "running" matches "run"
3. **Concurrency**: Non-blocking reads during index updates
4. **Type Safety**: Full TypeScript coverage with strict mode
