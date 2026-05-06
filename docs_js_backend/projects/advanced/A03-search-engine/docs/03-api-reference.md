# A03 Search Engine Backend - API Reference

## Search Endpoints

### GET /search
Search documents with full-text query and optional filters.

**Query Parameters:**
| Parameter | Type    | Required | Description                          |
|-----------|---------|----------|--------------------------------------|
| q         | string  | Yes      | Search query                         |
| tags      | string  | No       | Comma-separated tag filters          |
| dateFrom  | string  | No       | ISO date string (inclusive)          |
| dateTo    | string  | No       | ISO date string (inclusive)          |
| limit     | number  | No       | Results per page (default: 10)       |
| offset    | number  | No       | Pagination offset (default: 0)       |
| highlight | boolean | No       | Include highlighted snippets         |

**Response:**
```json
{
  "results": [
    {
      "document": {
        "id": "uuid",
        "title": "Document Title",
        "content": "Document content...",
        "tags": ["tag1", "tag2"],
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
      },
      "score": 2.456,
      "highlights": {
        "title": ["<mark>Document</mark> Title"],
        "content": ["...<mark>content</mark>..."]
      }
    }
  ],
  "total": 42,
  "facets": {
    "tags": [
      { "value": "javascript", "count": 15 },
      { "value": "python", "count": 10 }
    ],
    "dateRanges": [
      { "value": "2024", "count": 20 },
      { "value": "2023", "count": 22 }
    ]
  },
  "query": "search term",
  "took": 15
}
```

### GET /stats
Get index statistics.

**Response:**
```json
{
  "totalDocuments": 150,
  "totalTerms": 3420,
  "averageDocumentLength": 245.5
}
```

## Document Endpoints

### POST /documents
Index a new document.

**Request Body:**
```json
{
  "title": "Document Title",
  "content": "Document content...",
  "tags": ["tag1", "tag2"]
}
```

**Validation Rules:**
- `title`: required, 1-500 characters
- `content`: required, 1-50000 characters
- `tags`: optional, array of strings (1-50 chars each)

### GET /documents
List all documents.

**Query Parameters:**
| Parameter | Type   | Default | Description       |
|-----------|--------|---------|-------------------|
| limit     | number | 10      | Items per page    |
| offset    | number | 0       | Pagination offset |

### GET /documents/:id
Retrieve a specific document.

### PATCH /documents/:id
Update a document partially.

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "tags": ["new-tag"]
}
```

### DELETE /documents/:id
Delete a document.

## Error Responses

All errors follow this format:
```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
```

**Status Codes:**
- `400` - Bad Request (validation error)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
