# A10 Evolution: v3 — Add Validation

## State of the System

Every write, replication message, and routing request is validated at runtime. The system rejects malformed vector clocks, invalid region names, and non-object values before they reach storage or conflict resolution.

## What Changed

- **Zod schemas for all routes.**
  - `updateSchema` — `value: z.record(z.unknown())` (must be an object).
  - `replicateSchema` — `type: z.literal('replicate')`, `record: z.object({ id: z.string(), value: z.unknown(), timestamp: z.number(), region: z.string(), vectorClock: z.record(z.number().int().nonnegative()), version: z.number().int() })`, `sourceRegion: z.string()`.
  - `routeSchema` — `userId: z.string().min(1)`, `clientRegion: z.enum(['us-east', 'us-west', 'eu-west']).optional()`.
  - `conflictSchema` — `local: recordSchema`, `remote: recordSchema`.
- **Vector clock validation.** Every entry in `vectorClock` must be a non-negative integer. A malformed clock like `{"us-east": "abc"}` is rejected with HTTP 400.
- **Region whitelist.** `clientRegion` must be one of the known regions. Unknown regions are rejected to prevent routing to non-existent instances.
- **Conflict resolution endpoint.** `POST /api/conflict/resolve` accepts two `RecordData` objects and returns the resolved winner. This enables external merge logic.

## What Still Breaks

- **Last-write-wins on conflicts.** Valid `ConflictResult` objects still use `timestamp` to pick the winner. Clock skew of 500 ms causes data loss.
- **Replication loop.** Valid `ReplicationMessage` objects are re-replicated to all peers, including the source. The loop consumes 100% CPU.
- **No deduplication.** A valid replication message with an older vector clock overwrites a newer local version because `receiveReplication()` does not compare clocks before writing.
- **No structured logging.** Validation errors are logged to `console.error`, but replication events and conflict detections produce no audit trail.

## Code Snapshot (routes/index.ts)

```typescript
router.post('/data/:id', (req, res) => {
  const parsed = updateSchema.parse(req.body);
  const storage = req.app.locals.storageService;
  const replication = req.app.locals.replicationService;
  const record = storage.update(req.params.id, parsed.value);
  replication.replicate(record);
  res.json(record);
});

router.post('/replicate', (req, res) => {
  const parsed = replicateSchema.parse(req.body);
  const replication = req.app.locals.replicationService;
  const result = replication.receiveReplication(parsed);
  res.json(result);
});
```

## Architectural Notes

This is the "replication + conflict resolution" stage. The system now validates that replication messages carry well-formed vector clocks and that region names are known. The conflict resolution endpoint exposes the merge logic for testing. However, the core algorithm is still broken: it detects concurrency with vector clocks but resolves it with wall-clock timestamps, defeating the purpose of vector clocks.

## Migration Path to v4

1. Replace `last-write-wins` with an application-level merge strategy (object spread for maps, array union for sets).
2. Add `excludeRegion` to `ReplicationService.replicate()` to prevent loops.
3. Add deduplication by comparing vector clocks in `receiveReplication()` before overwriting.
4. Introduce structured JSON logging for every replication event and conflict detection.
