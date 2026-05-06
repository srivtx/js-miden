# Thinking Process

## Analyzing the Duplicate Detection Bug

### Why Exact Matching Fails

Natural language is fuzzy. Humans express the same idea in many ways:
- "Car accident on Main Street"
- "car accident on main street"
- "Auto collision on Main St."
- "Vehicle crash at Main Street intersection"
- "Main Street car accident"

All describe the same event but have different byte representations.

### The Duplicate Detection Problem

This is a classic **near-duplicate detection** or **text similarity** problem. Common approaches:

1. **Normalization**: Lowercase, remove punctuation, standardize abbreviations
2. **N-gram fingerprinting**: Break text into word sequences, hash them
3. **Levenshtein distance**: Measure edit distance between strings
4. **Cosine similarity**: Vectorize text, measure angle between vectors
5. **Semantic similarity**: Use embeddings (Word2Vec, BERT) to capture meaning
6. **Phone number/address matching**: Entity extraction and canonicalization

### Our Constraints

- Must work in Node.js backend
- Should be fast (< 100ms per comparison)
- No ML model dependencies if possible
- Must handle moderate text lengths (descriptions up to 1000 chars)
- Database should help filter before expensive comparison

### Solution Approach

**Hybrid strategy**:
1. **Database filtering**: Exact match on policy + date + amount (fast index)
2. **Normalization**: Standardize text before comparison
3. **Similarity threshold**: Use Jaccard similarity or Levenshtein distance
4. **Confidence scoring**: Report similarity percentage

```typescript
function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .replace(/\b(st|street)\b/g, 'street') // Standardize abbreviations
    .replace(/\b(ave|avenue)\b/g, 'avenue')
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}
```

### False Positives vs False Negatives

- **False positive** (flag as duplicate when it's not): Annoying for user, but safe
- **False negative** (miss a duplicate): Financial loss, fraud succeeds

In insurance, we prefer false positives. Better to manually review than pay fraud.
