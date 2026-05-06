import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getPosts, getAuthor } from '../src/resolvers.js';

describe('GraphQL Resolvers', () => {
  it('should fetch posts', () => {
    const result = getPosts();
    assert.strictEqual(result.length, 3);
  });

  it('should fetch author by id', () => {
    const result = getAuthor('1');
    assert.strictEqual(result?.name, 'Alice');
  });

  // FAILING TEST: N+1 detection
  it('should batch author fetches (DataLoader)', async () => {
    const consoleLogs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => consoleLogs.push(args.join(' '));

    const posts = getPosts();
    // Fetch all authors - should be batched into a single call
    posts.forEach(p => getAuthor(p.authorId));

    console.log = originalLog;

    // Currently fails: getAuthor is called once per post (N+1)
    // Should pass when DataLoader batches requests
    const authorFetches = consoleLogs.filter(l => l.startsWith('Fetching author'));
    assert.strictEqual(authorFetches.length, 1, `Expected 1 batched fetch, got ${authorFetches.length}`);
  });
});
