import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { submitContent } from '../src/content.js';
import { aiCheck } from '../src/ai-check.js';
import { addToHumanReviewQueue, humanReview, getPendingReviews } from '../src/human-review.js';

describe('Human Review', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should add flagged content to review queue', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Buy now! Spam!' });
    await aiCheck(content.id);
    const item = await addToHumanReviewQueue(content.id);
    expect(item.status).toBe('pending');
    expect(item.contentId).toBe(content.id);
  });

  it('should list pending reviews', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await addToHumanReviewQueue(content.id);
    const pending = await getPendingReviews();
    expect(pending).toHaveLength(1);
  });

  it('should approve content via human review', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await addToHumanReviewQueue(content.id);
    const updated = await humanReview(content.id, 'reviewer_1', 'approved', 'Looks fine');
    expect(updated!.status).toBe('approved');
    expect(updated!.humanDecision!.decision).toBe('approved');
  });

  it('should reject content via human review', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await addToHumanReviewQueue(content.id);
    const updated = await humanReview(content.id, 'reviewer_1', 'rejected', 'Violates rules');
    expect(updated!.status).toBe('rejected');
    expect(updated!.humanDecision!.decision).toBe('rejected');
  });

  // This test demonstrates the race condition bug:
  // Two reviewers could simultaneously approve and reject the same content.
  // The humanReview function reads content, then updates it without checking
  // if another review happened in between.
  it('should not allow conflicting simultaneous reviews', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await addToHumanReviewQueue(content.id);

    // Simulate two reviewers acting at the same time
    const review1 = humanReview(content.id, 'reviewer_a', 'approved', 'Looks fine');
    const review2 = humanReview(content.id, 'reviewer_b', 'rejected', 'Violates rules');

    const [result1, result2] = await Promise.all([review1, review2]);

    // Both returned successfully, but one overwrote the other.
    // We can't guarantee which one won, but the audit trail should show BOTH.
    const finalContent = await storage.getContent(content.id);
    const auditTrail = await storage.getAuditTrail(content.id);

    // EXPECTED: Audit trail should contain both review decisions.
    // ACTUAL (BUG): Only one audit log exists because the second update
    // overwrites the first without any concurrency control.
    const approvedLogs = auditTrail.filter(l => l.action === 'human_approved');
    const rejectedLogs = auditTrail.filter(l => l.action === 'human_rejected');
    expect(approvedLogs.length + rejectedLogs.length).toBeGreaterThanOrEqual(2);
  });
});
