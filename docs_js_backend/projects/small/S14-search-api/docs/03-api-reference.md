# API Reference

## POST /api/index

Index a new document.

**Request Body:**
```json
{
  "title": "Running Guide",
  "content": "Running is great for runners."
}
```

**Response:**
```json
{
  "document": {
    "id": 1,
    "title": "Running Guide",
    "content": "Running is great for runners.",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## GET /api/search

Search documents using full-text search.

**Query Parameters:**
- `q` (string, required): Search query
- `page` (number, default 1)
- `limit` (number, default 10, max 50)

**Response:**
```json
{
  "results": [
    {
      "id": 1,
      "title": "Running Guide",
      "content": "Running is great for runners.",
      "rank": 0.123,
      "highlights": ["<mark>Running</mark> is great..."]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

## GET /api/search-slow (Bug Demo)

Uses `ILIKE` instead of `tsvector`. Demonstrates slow performance on large datasets.

## GET /api/search-unsafe (Bug Demo)

Concatenates user input directly into SQL. Demonstrates SQL injection vulnerability.
