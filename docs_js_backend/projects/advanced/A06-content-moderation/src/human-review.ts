import { storage } from './storage.js';
import { ContentItem, HumanDecision } from './content.js';

export interface HumanReviewQueueItem {
  id: string;
  contentId: string;
  status: 'pending' | 'in_review' | 'completed';
  assignedTo?: string;
  createdAt: number;
  completedAt?: number;
}

export async function addToHumanReviewQueue(contentId: string): Promise<HumanReviewQueueItem> {
  const item: HumanReviewQueueItem = {
    id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    contentId,
    status: 'pending',
    createdAt: Date.now(),
  };
  await storage.saveReviewQueueItem(item);

  await storage.updateContent(contentId, { status: 'human_review' });

  await storage.addAuditLog({
    contentId,
    action: 'queued_for_human_review',
    timestamp: Date.now(),
  });

  return item;
}

export async function humanReview(contentId: string, reviewerId: string, decision: 'approved' | 'rejected', reason: string): Promise<ContentItem | null> {
  const content = await storage.getContent(contentId);
  if (!content) {
    return null;
  }

  // BUG: Race condition. Two reviewers could simultaneously approve and reject
  // the same content because we read the content, then update it without
  // checking if another review happened in between.
  const humanDecision: HumanDecision = {
    reviewerId,
    decision,
    reason,
    decidedAt: Date.now(),
  };

  const newStatus = decision === 'approved' ? 'approved' : 'rejected';

  await storage.updateContent(contentId, {
    status: newStatus,
    humanDecision,
  });

  await storage.addAuditLog({
    contentId,
    action: decision === 'approved' ? 'human_approved' : 'human_rejected',
    details: { reviewerId, reason },
    timestamp: Date.now(),
  });

  return storage.getContent(contentId);
}

export async function getPendingReviews(): Promise<HumanReviewQueueItem[]> {
  return storage.getPendingReviewQueueItems();
}
