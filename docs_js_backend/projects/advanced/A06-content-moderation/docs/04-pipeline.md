# A06: Content Moderation Pipeline - Pipeline

## Overview

The moderation pipeline processes all submitted content through a series of stages before publication.

## Pipeline Stages

### 1. Submission
- User submits content via `POST /content/submit`
- Content stored with status `submitted`
- Audit log entry created

### 2. AI Review
- Automated analysis runs via `POST /content/:id/ai-check`
- Content status changes to `ai_review`
- AI result stored with the content

### 3. Routing Decision
- If AI flags content: queued for human review
- If AI approves content: eligible for immediate publishing

### 4. Human Review
- Reviewer examines flagged content
- Decision: `approved` or `rejected`
- Content status updated accordingly

### 5. Publishing
- Only `approved` content can be published
- Published content gets `published` status and timestamp

### 6. Appeals (if rejected)
- User creates appeal with reason
- Admin processes appeal: `approved` or `rejected`
- Content status updated based on appeal outcome

## Status Transitions

```
submitted → ai_review → human_review → approved → published
                                    → rejected → appeal → approved
                                                         → rejected
```

## Known Bug: Pipeline Race Condition

**Problem**: Two reviewers can simultaneously approve and reject the same content because `humanReview()` reads the content and updates it without checking for concurrent modifications.

**Impact**:
- Inconsistent final state
- Audit trail may miss one of the decisions
- Content could be published after being rejected

**Recommended Fix**:
Use optimistic locking or database transactions:

```typescript
// Optimistic locking with version numbers
async function humanReview(id, reviewerId, decision) {
  const content = await db.getContent(id);
  const updated = await db.updateContent(id, {
    status: decision,
    version: content.version + 1,
  }, {
    where: { version: content.version } // Only update if version matches
  });
  if (!updated) throw new Error('Content was modified by another reviewer');
}
```

## Queue Processing

The queue system handles background pipeline jobs:

1. Jobs are enqueued with type and contentId
2. Workers poll for pending jobs
3. Jobs are marked `processing`, then `completed` or `failed`

## Phase 2-3 Enhancements

- **Priority Queue**: Urgent content gets reviewed first
- **Batch Processing**: Process multiple AI checks in parallel
- **Webhooks**: Notify clients when content status changes
- **Sliding Window Reviews**: Require multiple reviewer consensus for borderline content
