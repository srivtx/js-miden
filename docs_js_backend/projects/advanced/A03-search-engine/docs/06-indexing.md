# A03 Search Engine Backend - Indexing

## Indexing Process

### Document Indexing Flow

```
Client Request
     │
     ▼
┌─────────────┐
│ Validate    │
│ Input       │
└─────────────┘
     │
     ▼
┌─────────────┐     ┌──────────────┐
│ Create      │────▶│ Save to      │
│ Document    │     │ DocumentStore│
│ Object      │     │ (async)      │
└─────────────┘     └──────────────┘
     │
     ▼
┌─────────────┐     ┌──────────────┐
│ Tokenize &  │────▶│ Update       │
│ Stem Text   │     │ InvertedIndex│
└─────────────┘     │ (async)      │
                    └──────────────┘
```

## Non-Blocking Updates

### Problem: Table Locking

A common bug is locking the entire index during updates, blocking all reads:

```javascript
// BAD: Synchronous blocking update
function indexDocument(doc) {
  lock.acquire();      // Blocks ALL reads
  index.add(doc);      // Slow operation
  lock.release();
}
```

### Solution: Async Queue

Our implementation uses an async queue with `setImmediate`:

```javascript
// GOOD: Non-blocking update
async function indexDocument(doc) {
  await documentStore.save(doc);  // Queued, yields control
  await invertedIndex.add(doc);   // Queued, yields control
}
```

### Implementation Details

**DocumentStore** uses a write queue:
- Multiple reads can proceed concurrently
- Writes are serialized but non-blocking
- `setImmediate` yields to the event loop

**InvertedIndex** uses similar queue semantics:
- Reads access the Map directly
- Writes queue behind a simple flag
- No copy-on-write overhead for this implementation

## Update Operations

### Create
1. Generate UUID
2. Set timestamps
3. Save to DocumentStore
4. Tokenize title and content
5. Update InvertedIndex postings

### Update
1. Retrieve existing document
2. Merge changes
3. Update timestamp
4. Save to DocumentStore
5. Re-index (remove old + add new postings)

### Delete
1. Remove from DocumentStore
2. Remove all postings from InvertedIndex

## Performance Considerations

- **Batch Indexing**: For bulk operations, consider batching writes
- **Memory Usage**: In-memory only; for production, persist to disk
- **Index Size**: Each unique stemmed term consumes memory
- **Real-time**: Updates are visible immediately after completion
