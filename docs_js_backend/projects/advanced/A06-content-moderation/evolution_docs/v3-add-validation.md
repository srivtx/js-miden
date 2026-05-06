# A06 Evolution: v3 — Add Validation

## State of the System

Every inbound route now has a Zod schema. Malformed requests are rejected with a structured `VALIDATION_ERROR` before they reach business logic. The audit trail is protected from garbage data.

## What Changed

- **Zod schemas for all routes.**
  - `ContentBody` — `userId: z.string().min(1)`, `text: z.string().min(1)`.
  - `ReviewBody` — `reviewerId: z.string().min(1)`, `decision: z.enum(['approved', 'rejected'])`, `reason: z.string().optional()`.
  - `AppealBody` — `userId: z.string().min(1)`, `reason: z.string().min(1)`.
  - `AppealProcessBody` — `resolverId: z.string().min(1)`, `approved: z.boolean()`.
- **Validation middleware.** `createSchema.parse(req.body)` throws `ZodError`, which the global `errorHandler` catches and converts to HTTP 400 with `error.code: 'VALIDATION_ERROR'` and `error.issues`.
- **Protected pipeline transitions.** `publishContent()` checks `content.status === 'approved'` before publishing. A rejected or pending item cannot be published.
- **Queue job validation.** `enqueueJob()` validates `type` against `z.enum(['ai_check', 'human_review', 'publish'])`.

## What Still Breaks

- **Race condition in human review.** Two reviewers can still submit valid `{ reviewerId, decision }` bodies simultaneously. Zod validates shape, not concurrency.
- **Appeal overwrites original decision without preserving history.** The audit log records `appeal_approved` but does not snapshot the previous `humanDecision`. The transition is lost.
- **No rate limiting.** A malicious client can submit 10,000 content items per minute. Zod validates each one, but the server accepts all of them.
- **No structured logging.** Validation errors go to `console.error` via the error handler, but there is no correlation ID, no timestamp standardization, and no log aggregation format.

## Code Snapshot (routes)

```typescript
const createSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1),
});

router.post('/submit', async (req: Request, res: Response) => {
  try {
    const body = createSchema.parse(req.body);
    const content = await submitContent(body);
    res.status(201).json(content);
  } catch (err) {
    next(err); // ZodError caught by errorHandler
  }
});
```

## Architectural Notes

This is the "rule-based" stage. The system now enforces business rules at the boundary: a review decision must be `approved` or `rejected`, an appeal must have a `reason`, and publishing requires prior approval. The pipeline is still deterministic (no ML confidence yet), but it is no longer possible to inject garbage that corrupts downstream stages.

## Migration Path to v4

1. Replace `console.error` with a structured JSON logger that includes `requestId`, `timestamp`, `route`, and `validationIssues`.
2. Add per-route rate limiting (e.g., 100 submissions per minute per IP).
3. Introduce the ML pipeline stage: `aiCheck()` should return a `confidence` score that determines whether human review is required.
