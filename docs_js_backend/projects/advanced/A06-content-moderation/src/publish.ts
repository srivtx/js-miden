import { storage } from './storage.js';
import { ContentItem } from './content.js';

export async function publishContent(contentId: string): Promise<ContentItem | null> {
  const content = await storage.getContent(contentId);
  if (!content) {
    return null;
  }

  if (content.status !== 'approved') {
    throw new Error('Content must be approved before publishing');
  }

  const updated = await storage.updateContent(contentId, {
    status: 'published',
    publishedAt: Date.now(),
  });

  await storage.addAuditLog({
    contentId,
    action: 'published',
    timestamp: Date.now(),
  });

  return updated;
}
