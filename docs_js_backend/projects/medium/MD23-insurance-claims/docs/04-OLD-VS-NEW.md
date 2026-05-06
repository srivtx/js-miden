# Old vs New Approach

## Old Approach (Buggy)

```typescript
async submitClaim(data) {
  // BUG: Exact string matching - easily bypassed!
  const duplicateCheck = await prisma.claim.findFirst({
    where: {
      policyId: data.policyId,
      incidentDate: data.incidentDate,
      description: data.description, // Exact match only
      amountRequested: data.amountRequested,
      status: { not: 'DENIED' },
    },
  });

  if (duplicateCheck) {
    throw new AppError(409, 'Duplicate claim detected', 'DUPLICATE_CLAIM');
  }

  return prisma.claim.create({ data });
}
```

**Problems**:
- Byte-level comparison of natural language
- No normalization of input
- No semantic understanding
- Easy to bypass with trivial modifications
- Doesn't catch rearranged descriptions

## New Approach (Fixed)

```typescript
async submitClaim(data) {
  // Step 1: Find potential duplicates by indexed fields
  const candidates = await prisma.claim.findMany({
    where: {
      policyId: data.policyId,
      incidentDate: data.incidentDate,
      amountRequested: data.amountRequested,
      status: { not: 'DENIED' },
    },
  });

  // Step 2: Normalize and compare descriptions
  const normalizedNew = normalizeDescription(data.description);
  const newWords = new Set(normalizedNew.split(' '));

  for (const candidate of candidates) {
    const normalizedExisting = normalizeDescription(candidate.description);
    const existingWords = new Set(normalizedExisting.split(' '));
    
    const similarity = jaccardSimilarity(newWords, existingWords);
    
    if (similarity >= 0.85) {
      throw new AppError(409, 
        `Duplicate claim detected (similarity: ${(similarity * 100).toFixed(1)}%)`, 
        'DUPLICATE_CLAIM'
      );
    }
  }

  return prisma.claim.create({ data });
}

function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(st|street|str)\b/g, 'street')
    .replace(/\b(ave|avenue|av)\b/g, 'avenue')
    .replace(/\b(rd|road)\b/g, 'road')
    .replace(/\b(dr|drive)\b/g, 'drive')
    .replace(/\b(blvd|boulevard)\b/g, 'boulevard')
    .trim();
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}
```

**Improvements**:
- Normalizes text before comparison
- Uses set-based similarity (order-independent)
- Standardizes common abbreviations
- Provides confidence score in error message
- Catches minor variations and typos

## Advanced Alternative: Vector Similarity

For production systems, use embeddings:

```typescript
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

async function semanticSimilarity(text1: string, text2: string): number {
  const [emb1, emb2] = await Promise.all([
    embedder(text1, { pooling: 'mean', normalize: true }),
    embedder(text2, { pooling: 'mean', normalize: true }),
  ]);
  
  // Cosine similarity
  return dotProduct(emb1.data, emb2.data);
}
```

This catches paraphrases that word-based methods miss.
