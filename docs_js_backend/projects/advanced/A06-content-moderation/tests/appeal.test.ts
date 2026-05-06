import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { submitContent } from '../src/content.js';
import { aiCheck } from '../src/ai-check.js';
import { addToHumanReviewQueue, humanReview } from '../src/human-review.js';
import { createAppeal, processAppeal, getAppeals } from '../src/appeal.js';
import { getAuditTrail } from '../src/audit.js';

describe('Appeals', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should create an appeal for rejected content', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await addToHumanReviewQueue(content.id);
    await humanReview(content.id, 'reviewer_1', 'rejected', 'Violates rules');

    const appeal = await createAppeal(content.id, 'user_1', 'I think this is unfair');
    expect(appeal.status).toBe('pending');
    expect(appeal.reason).toBe('I think this is unfair');
  });

  it('should process an appeal and approve content', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await addToHumanReviewQueue(content.id);
    await humanReview(content.id, 'reviewer_1', 'rejected', 'Violates rules');
    const appeal = await createAppeal(content.id, 'user_1', 'Please reconsider');

    const processed = await processAppeal(appeal.id, 'admin_1', true);
    expect(processed!.status).toBe('approved');

    const updatedContent = await storage.getContent(content.id);
    expect(updatedContent!.status).toBe('approved');
  });

  it('should process an appeal and reject content', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await addToHumanReviewQueue(content.id);
    await humanReview(content.id, 'reviewer_1', 'rejected', 'Violates rules');
    const appeal = await createAppeal(content.id, 'user_1', 'Please reconsider');

    const processed = await processAppeal(appeal.id, 'admin_1', false);
    expect(processed!.status).toBe('rejected');
  });

  it('should list appeals for content', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await createAppeal(content.id, 'user_1', 'Reason 1');
    await createAppeal(content.id, 'user_1', 'Reason 2');
    const appeals = await getAppeals(content.id);
    expect(appeals).toHaveLength(2);
  });

  // This test demonstrates the appeal history bug:
  // When an appeal is processed, it overwrites the content status directly
  // without preserving the original human decision in the audit trail.
  // The transition from "human_rejected" to "appeal_approved" is not fully
  // captured as a state transition record.
  it('should preserve original decision history when appeal is processed', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Spam!' });
    await aiCheck(content.id);
    await addToHumanReviewQueue(content.id);
    await humanReview(content.id, 'reviewer_1', 'rejected', 'Violates rules');

    // Capture state before appeal
    const beforeAppeal = await storage.getContent(content.id);
    expect(beforeAppeal!.status).toBe('rejected');

    const appeal = await createAppeal(content.id, 'user_1', 'I disagree');
    await processAppeal(appeal.id, 'admin_1', true);

    const auditTrail = await getAuditTrail(content.id);

    // The audit trail should clearly show:
    // 1. The original human rejection
    // 2. The appeal creation
    // 3. The appeal approval WITH reference to the original decision
    const humanRejected = auditTrail.find(l => l.action === 'human_rejected');
    const appealCreated = auditTrail.find(l => l.action === 'appeal_created');
    const appealApproved = auditTrail.find(l => l.action === 'appeal_approved');

    expect(humanRejected).toBeDefined();
    expect(appealCreated).toBeDefined();
    expect(appealApproved).toBeDefined();

    // BUG: appealApproved.details.originalStatus contains the status at the time
    // processAppeal was called, but there is no explicit "state_transition" log
    // that preserves the full before/after context. In a proper system, we should
    // see a dedicated record: { from: 'rejected', to: 'approved', via: 'appeal' }.
    expect(appealApproved!.details).toMatchObject({
      originalStatus: 'rejected',
    });

    // Additionally, the content's humanDecision field still shows the ORIGINAL
    // rejection, but the audit trail doesn't link the appeal decision to it.
    // This makes it impossible to explain why the content was removed/reinstated
    // from the audit trail alone.
    const transitionLogs = auditTrail.filter(l =>
      l.action.includes('transition') || (l.details && (l.details as any).from && (l.details as any).to)
    );
    expect(transitionLogs.length).toBeGreaterThanOrEqual(1);
  });
});
