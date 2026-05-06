# 05-dataloader.md

## WHAT

DataLoader is a utility for batching and caching per-request data fetches.

## WHY

The N+1 problem: fetching posts then their authors results in 1 query for posts + N queries for authors. DataLoader batches the N author queries into 1.

## HOW

```typescript
import DataLoader from 'dataloader';

const authorLoader = new DataLoader<string, Author | undefined>(async (ids) => {
  console.log(`Batch fetching authors: ${ids}`);
  return ids.map(id => authors.find(a => a.id === id));
});

// In resolver:
resolve: (post) => authorLoader.load(post.authorId),
```

DataLoader coalesces all loads within a single tick of the event loop into one batch function call.
