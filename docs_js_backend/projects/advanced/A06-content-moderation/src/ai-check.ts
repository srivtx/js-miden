import { storage } from './storage.js';
import { ContentItem, AIResult } from './content.js';

export interface AICheckResult {
  contentId: string;
  result: AIResult;
}

export async function aiCheck(contentId: string): Promise<AICheckResult> {
  const content = await storage.getContent(contentId);
  if (!content) {
    throw new Error('Content not found');
  }

  // Mock AI check
  const text = content.text.toLowerCase();
  const categories: string[] = [];
  let flagged = false;
  let confidence = 0.1;

  if (text.includes('spam') || text.includes('buy now')) {
    categories.push('spam');
    flagged = true;
    confidence = 0.85;
  }
  if (text.includes('hate') || text.includes('attack')) {
    categories.push('hate_speech');
    flagged = true;
    confidence = 0.92;
  }
  if (text.includes('fake') || text.includes('scam')) {
    categories.push('misinformation');
    flagged = true;
    confidence = 0.78;
  }

  const result: AIResult = {
    flagged,
    categories,
    confidence,
    checkedAt: Date.now(),
  };

  await storage.updateContent(contentId, {
    status: 'ai_review',
    aiResult: result,
  });

  // Add audit log for AI check
  await storage.addAuditLog({
    contentId,
    action: flagged ? 'ai_flagged' : 'ai_approved',
    details: { categories, confidence },
    timestamp: Date.now(),
  });

  return { contentId, result };
}

export async function getAICheckResult(contentId: string): Promise<AIResult | null> {
  const content = await storage.getContent(contentId);
  return content?.aiResult || null;
}
