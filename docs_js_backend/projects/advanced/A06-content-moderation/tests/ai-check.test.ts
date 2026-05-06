import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { submitContent } from '../src/content.js';
import { aiCheck, getAICheckResult } from '../src/ai-check.js';

describe('AI Check', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should flag spam content', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Buy now! Amazing spam deal!' });
    const result = await aiCheck(content.id);
    expect(result.result.flagged).toBe(true);
    expect(result.result.categories).toContain('spam');
  });

  it('should flag hate speech', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'I hate and attack everyone' });
    const result = await aiCheck(content.id);
    expect(result.result.flagged).toBe(true);
    expect(result.result.categories).toContain('hate_speech');
  });

  it('should not flag benign content', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Hello world, nice weather today' });
    const result = await aiCheck(content.id);
    expect(result.result.flagged).toBe(false);
    expect(result.result.categories).toHaveLength(0);
  });

  it('should update content status after AI check', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Buy now!' });
    await aiCheck(content.id);
    const updated = await storage.getContent(content.id);
    expect(updated!.status).toBe('ai_review');
    expect(updated!.aiResult).toBeDefined();
  });

  it('should retrieve AI check result', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Buy now!' });
    await aiCheck(content.id);
    const result = await getAICheckResult(content.id);
    expect(result).toBeDefined();
    expect(result!.confidence).toBeGreaterThan(0);
  });
});
