import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { submitContent } from '../src/content.js';
import { aiCheck } from '../src/ai-check.js';
import { addToHumanReviewQueue, humanReview } from '../src/human-review.js';
import { createAppeal, processAppeal } from '../src/appeal.js';
import { getAuditTrail, logAction } from '../src/audit.js';

describe('Audit Trail', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should log content submission', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Hello' });
    await logAction(content.id, 'submitted', { userId: 'user_1' });
    const trail = await getAuditTrail(content.id);
    expect(trail.some(l => l.action === 'submitted')).toBe(true);
  });

  it('should log AI check actions', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await aiCheck(content.id);
    const trail = await getAuditTrail(content.id);
    expect(trail.some(l => l.action === 'ai_flagged')).toBe(true);
  });

  it('should log human review decisions', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await addToHumanReviewQueue(content.id);
    await humanReview(content.id, 'reviewer_1', 'rejected', 'Bad content');
    const trail = await getAuditTrail(content.id);
    expect(trail.some(l => l.action === 'human_rejected')).toBe(true);
  });

  it('should contain a complete audit trail for the pipeline', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam deal!' });
    await aiCheck(content.id);
    await addToHumanReviewQueue(content.id);
    await humanReview(content.id, 'reviewer_1', 'rejected', 'Spam');
    const appeal = await createAppeal(content.id, 'user_1', 'Unfair');
    await processAppeal(appeal.id, 'admin_1', true);

    const trail = await getAuditTrail(content.id);
    expect(trail.length).toBeGreaterThanOrEqual(5);

    // Verify chronological order
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i].timestamp).toBeGreaterThanOrEqual(trail[i - 1].timestamp);
    }
  });

  // This test demonstrates the missing audit trail bug:
  // If content is removed, we should be able to explain exactly why.
  // The current system logs actions, but doesn't capture the REASON
  // in a queryable way for every state transition.
  it('should explain why content was removed from audit trail alone', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Hate speech!' });
    await aiCheck(content.id);
    await addToHumanReviewQueue(content.id);
    await humanReview(content.id, 'reviewer_1', 'rejected', 'Hate speech detected');

    const trail = await getAuditTrail(content.id);

    // We should be able to reconstruct the full decision from the audit trail
    const rejectionLog = trail.find(l => l.action === 'human_rejected');
    expect(rejectionLog).toBeDefined();
    expect(rejectionLog!.details).toMatchObject({
      reason: 'Hate speech detected',
    });
  });
});
