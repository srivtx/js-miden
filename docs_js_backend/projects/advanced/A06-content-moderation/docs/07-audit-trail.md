# A06: Content Moderation Pipeline - Audit Trail

## Overview

The audit trail provides an immutable history of all moderation actions. It is essential for regulatory compliance, debugging, and explaining moderation decisions.

## Data Model

```typescript
interface AuditLog {
  id: string;
  contentId: string;
  action: string;
  details?: Record<string, unknown>;
  timestamp: number;
}
```

## Logged Actions

| Action | When | Details |
|--------|------|---------|
| submitted | Content submitted | { userId } |
| ai_flagged | AI detects violation | { categories, confidence } |
| ai_approved | AI clears content | { categories, confidence } |
| queued_for_human_review | Added to queue | {} |
| human_approved | Reviewer approves | { reviewerId, reason } |
| human_rejected | Reviewer rejects | { reviewerId, reason } |
| appeal_created | User appeals | { userId, reason } |
| appeal_approved | Appeal granted | { resolverId, originalStatus } |
| appeal_rejected | Appeal denied | { resolverId, originalStatus } |
| published | Content published | {} |

## Known Bug: Incomplete Audit Trail for Appeals

**Problem**: When an appeal is processed, the audit log records the appeal outcome but does not explicitly capture the state transition. The original human decision is present in the `humanDecision` field of the content, but the audit trail lacks a dedicated "transition" record showing:
- From: `rejected` (human decision)
- To: `approved` (appeal outcome)
- Reason: Appeal resolution

This makes it difficult to reconstruct the full decision history from audit logs alone.

**Example of Missing Information**:
```
Audit Trail:
1. submitted
2. ai_flagged
3. human_rejected
4. appeal_created
5. appeal_approved  <-- Missing: what was the state before this?
```

**Recommended Fix**:
Add explicit state transition logs:

```typescript
await storage.addAuditLog({
  contentId: content.id,
  action: 'state_transition',
  details: {
    from: 'rejected',
    to: 'approved',
    triggeredBy: 'appeal',
    appealId: appeal.id,
  },
  timestamp: Date.now(),
});
```

## Compliance

### GDPR / CCPA
- Users have the right to know why content was moderated
- Audit trail must be queryable by content ID

### Transparency Reports
- Aggregate moderation statistics
- Appeal success rates
- AI accuracy metrics

## Phase 2-3 Enhancements

- **Immutable Storage**: Write audit logs to append-only storage (WORM)
- **Cryptographic Signing**: Sign each log entry to prevent tampering
- **Structured Logging**: Use JSON schema for machine-readable audit data
- **Retention Policies**: Auto-archive old audit data
