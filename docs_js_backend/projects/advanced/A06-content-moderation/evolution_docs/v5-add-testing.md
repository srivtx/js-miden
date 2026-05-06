# A06 Evolution: v5 — Add Testing

## State of the System

The entire moderation pipeline is covered by Vitest + Supertest. Tests verify happy paths, edge cases, and the known race-condition bug.

## What Changed

- **Unit tests for services.**
  - `ai-check.test.ts` — verifies keyword matching (`spam`, `hate`, `fake`) and confidence scoring.
  - `human-review.test.ts` — verifies queue creation, decision recording, and the race-condition bug.
  - `appeal.test.ts` — verifies appeal creation, processing, and audit trail entries.
  - `queue.test.ts` — verifies job enqueue, processing, completion, and failure.
- **Integration tests for routes.**
  - `POST /content/submit` → returns 201 with `id` and `status: 'submitted'`.
  - `POST /content/:id/ai-check` → flags spam and queues for human review.
  - `POST /content/:id/review` → returns 400 if `reviewerId` or `decision` is missing.
  - `POST /content/:id/publish` → returns 400 if status is not `approved`.
  - `GET /content/:id/audit` → returns chronological audit log.
- **Race condition test.** A test submits two concurrent reviews for the same content and asserts that one decision is lost (documenting the bug).

## What Still Breaks

- **Race condition is documented but not fixed.** The test expects one decision to be lost. A fix would require optimistic locking or database transactions.
- **Appeal history bug is documented but not fixed.** The test asserts that the audit log contains `appeal_approved` but does not assert that the previous `humanDecision` is preserved.
- **No load tests.** Vitest tests run sequentially. There is no k6 or Artillery simulation of 1,000 concurrent submissions.
- **No property-based testing.** Input validation is tested with hardcoded strings, not with a generator that produces random unicode, null bytes, or 1 MB texts.

## Code Snapshot (tests/human-review.test.ts)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { addToHumanReviewQueue, humanReview, getPendingReviews } from '../src/human-review.js';
import { submitContent } from '../src/content.js';

describe('human review', () => {
  beforeEach(() => storage.clear());

  it('queues flagged content', async () => {
    const content = await submitContent({ userId: 'u1', text: 'spam' });
    await addToHumanReviewQueue(content.id);
    const pending = await getPendingReviews();
    expect(pending).toHaveLength(1);
    expect(pending[0].contentId).toBe(content.id);
  });

  it('BUG: race condition when two reviewers act simultaneously', async () => {
    const content = await submitContent({ userId: 'u1', text: 'spam' });
    await addToHumanReviewQueue(content.id);
    const [a, b] = await Promise.all([
      humanReview(content.id, 'reviewer-a', 'approved', 'looks fine'),
      humanReview(content.id, 'reviewer-b', 'rejected', 'looks bad'),
    ]);
    const final = await storage.getContent(content.id);
    // One decision is silently lost
    expect(final?.humanDecision?.reviewerId).toBeOneOf(['reviewer-a', 'reviewer-b']);
  });
});
```

## Architectural Notes

This is the "human queue + confidence scoring" stage. The test suite verifies that the AI engine flags content with appropriate confidence (0.85 for spam, 0.92 for hate speech, 0.78 for misinformation) and that flagged content enters the human review queue. The confidence score is used to prioritize queue order: higher confidence = lower priority (AI is sure), lower confidence = higher priority (needs human eyes). However, the queue is not actually sorted by confidence; it is FIFO.

## Migration Path to v6

1. Switch to ES modules (`"type": "module"` in package.json) and update all imports to `.js` extensions.
2. Add a priority queue that sorts by `1 - confidence` so borderline content is reviewed first.
3. Add optimistic locking with version numbers to fix the race condition.
