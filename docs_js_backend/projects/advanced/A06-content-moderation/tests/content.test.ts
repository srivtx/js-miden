import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { submitContent, getContent, listContent, updateContentStatus } from '../src/content.js';

describe('Content', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should submit content with unique ID', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Hello world' });
    expect(content.id).toBeDefined();
    expect(content.id).toMatch(/^cnt_/);
    expect(content.status).toBe('submitted');
  });

  it('should retrieve content by ID', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Hello world' });
    const found = await getContent(content.id);
    expect(found).toBeDefined();
    expect(found!.text).toBe('Hello world');
  });

  it('should list all content', async () => {
    await submitContent({ userId: 'user_1', text: 'A' });
    await submitContent({ userId: 'user_2', text: 'B' });
    const items = await listContent();
    expect(items).toHaveLength(2);
  });

  it('should update content status', async () => {
    const content = await submitContent({ userId: 'user_1', text: 'Hello world' });
    const updated = await updateContentStatus(content.id, 'ai_review');
    expect(updated!.status).toBe('ai_review');
  });
});
