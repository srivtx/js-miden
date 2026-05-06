# A06 Evolution: v4 — Add Logging

## State of the System

Every action in the content lifecycle is logged as structured JSON. Logs include correlation IDs, timestamps, and pipeline stage metadata. The audit trail is queryable and can be shipped to a log aggregator.

## What Changed

- **Structured JSON logger.** `logInfo()` and `logError()` output single-line JSON with `level`, `message`, `timestamp`, and arbitrary metadata.
- **Audit trail via storage.** `storage.addAuditLog()` appends an `AuditLog` entry for every pipeline transition: `submitted`, `ai_flagged`, `ai_approved`, `queued_for_human_review`, `human_approved`, `human_rejected`, `published`, `appeal_created`, `appeal_approved`, `appeal_rejected`.
- **Per-content audit endpoint.** `GET /content/:id/audit` returns the full chronological audit trail for a content item.
- **Pipeline stage logging.** `aiCheck()` logs the `categories` and `confidence` of every AI result. `humanReview()` logs the `reviewerId` and `reason`. `processAppeal()` logs the `resolverId` and `originalStatus`.

## What Still Breaks

- **Appeal overwrites original decision without preserving history.** The audit log records `appeal_approved` with `originalStatus`, but the `humanDecision` object is not snapshotted. The full state transition from `human_rejected` → `appeal_approved` is partially lost.
- **Race condition in human review.** Two reviewers acting simultaneously still overwrite each other. Logs may show both `human_approved` and `human_rejected` for the same content, but the final state is whichever write landed last.
- **No request ID correlation.** Logs from the AI check, human review, and appeal handlers are independent. There is no `requestId` propagated across async boundaries.
- **No log shipping.** JSON logs are written to stdout, but there is no Filebeat, Fluentd, or CloudWatch agent configuration.

## Code Snapshot (utils/logger.ts)

```typescript
export function logInfo(message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
}

export function logError(message: string, error?: Error, meta?: Record<string, unknown>) {
  console.error(JSON.stringify({
    level: 'error', message, error: error?.message, stack: error?.stack,
    ...meta, timestamp: new Date().toISOString(),
  }));
}
```

## Architectural Notes

This is the "ML pipeline + audit trail" stage. The system now produces a complete, append-only log of every moderation decision. A compliance officer can query `GET /content/:id/audit` and see exactly when the AI flagged the content, which reviewer approved it, and whether an appeal was filed. However, the audit trail is not transactional: a crash between `storage.updateContent()` and `storage.addAuditLog()` creates an inconsistency.

## Migration Path to v5

1. Add request ID propagation via Express middleware and attach it to every log line.
2. Add Vitest tests that verify audit trail completeness after every pipeline transition.
3. Add a queue worker that processes `ai_check` jobs asynchronously and logs progress.
