# 04-transform.md

## WHAT

Transform validates, cleans, normalizes, and enriches data.

## WHY

Raw data is often messy. Transformation ensures data quality before loading.

## HOW

```typescript
function transform(records: RawRecord[]): Record[] {
  return records.map(row => ({
    id: row.id,
    name: row.name.trim(),
    email: validateEmail(row.email) ? row.email.toLowerCase() : null,
    age: parseInt(row.age, 10),
    enriched: enrichWithExternalData(row),
  })).filter(r => r.email !== null);
}
```

Common transformations:
- Type casting
- Null handling
- Deduplication
- Normalization
- Enrichment
