# A03 Search Engine Backend - Faceted Search

## Overview

Faceted search allows users to refine search results using multiple filters. The system supports:

1. **Tag Facets**: Filter by document tags
2. **Date Range Facets**: Filter by creation date

## How Faceting Works

### Query-Time Faceting

Unlike some systems that pre-compute facets, this engine calculates facets at query time:

```
1. Execute full-text search
2. Retrieve matching documents
3. Aggregate tag counts from matching docs
4. Aggregate date range counts
5. Return with results
```

### Tag Filtering

**Query:** `GET /search?q=javascript&tags=react,node`

**Logic:**
- Document must contain "javascript" in title or content
- Document must have EITHER "react" OR "node" tag

**Implementation:**
```typescript
if (query.tags && query.tags.length > 0) {
  filteredDocs = filteredDocs.filter((doc) =>
    query.tags!.some((tag) => doc.tags.includes(tag))
  );
}
```

### Date Range Filtering

**Query:** `GET /search?q=report&dateFrom=2024-01-01&dateTo=2024-12-31`

**Logic:**
- Document must contain "report"
- Document `createdAt` must be within specified range (inclusive)

**Implementation:**
```typescript
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
```

## Facet Aggregation

### Tag Facets

Count occurrences of each tag in the result set:

```typescript
const tagCounts = new Map<string, number>();
for (const doc of docs) {
  for (const tag of doc.tags) {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
}
```

### Date Range Facets

Group by year:

```typescript
const dateRangeCounts = new Map<string, number>();
for (const doc of docs) {
  const year = new Date(doc.createdAt).getFullYear().toString();
  dateRangeCounts.set(year, (dateRangeCounts.get(year) || 0) + 1);
}
```

## Response Format

```json
{
  "facets": {
    "tags": [
      { "value": "javascript", "count": 15 },
      { "value": "typescript", "count": 12 },
      { "value": "react", "count": 8 }
    ],
    "dateRanges": [
      { "value": "2024", "count": 45 },
      { "value": "2023", "count": 32 }
    ]
  }
}
```

## Future Enhancements

1. **Range Facets**: Support numeric ranges (e.g., price ranges)
2. **Hierarchical Facets**: Nested categories
3. **Facet Exclusion**: Show counts for OTHER facets if this one is selected
4. **Multi-Select**: AND logic for multiple tag selections
