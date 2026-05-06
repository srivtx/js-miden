import { storage } from './storage.js';
import { ContentItem } from './content.js';

export interface Appeal {
  id: string;
  contentId: string;
  userId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  resolvedAt?: number;
  resolverId?: string;
}

export async function createAppeal(contentId: string, userId: string, reason: string): Promise<Appeal> {
  const appeal: Appeal = {
    id: `apl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    contentId,
    userId,
    reason,
    status: 'pending',
    createdAt: Date.now(),
  };
  await storage.saveAppeal(appeal);

  await storage.addAuditLog({
    contentId,
    action: 'appeal_created',
    details: { userId, reason },
    timestamp: Date.now(),
  });

  return appeal;
}

export async function processAppeal(appealId: string, resolverId: string, approved: boolean): Promise<Appeal | null> {
  const appeal = await storage.getAppeal(appealId);
  if (!appeal) {
    return null;
  }

  const content = await storage.getContent(appeal.contentId);
  if (!content) {
    return null;
  }

  // BUG: Appeal overwrites original decision without preserving history.
  // We update the content status directly without recording what the
  // original human decision was before the appeal.
  const newStatus = approved ? 'approved' : 'rejected';
  await storage.updateContent(content.id, { status: newStatus });

  const updatedAppeal: Appeal = {
    ...appeal,
    status: approved ? 'approved' : 'rejected',
    resolvedAt: Date.now(),
    resolverId,
  };
  await storage.saveAppeal(updatedAppeal);

  // BUG: The audit log only records the appeal outcome, not the transition
  // from the original decision to the new decision. The original human
  // decision is lost in the content state transition.
  await storage.addAuditLog({
    contentId: content.id,
    action: approved ? 'appeal_approved' : 'appeal_rejected',
    details: { resolverId, originalStatus: content.status },
    timestamp: Date.now(),
  });

  return updatedAppeal;
}

export async function getAppeals(contentId: string): Promise<Appeal[]> {
  return storage.getAppealsForContent(contentId);
}
