import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, users, posts, userFeeds } from '../src/db.js';

describe('MD09 Social Feed', () => {
  beforeEach(() => {
    resetDb();
  });

  async function createUser(username: string, email: string) {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, email, password: 'password123' });
    return res.body;
  }

  async function login(email: string) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'password123' });
    return res.body.token;
  }

  describe('BUG: Fan-out blocks post creation', () => {
    it('should create posts quickly even with many followers', async () => {
      const author = await createUser('author', 'author@test.com');
      
      // Create 1000 followers
      for (let i = 0; i < 1000; i++) {
        await createUser(`follower${i}`, `f${i}@test.com`);
      }
      
      const token = await login('author@test.com');
      
      const start = Date.now();
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello world' });
      const duration = Date.now() - start;
      
      expect(res.status).toBe(201);
      // BUG: Fan-out is synchronous, so this will be slow (>100ms for 1000 followers)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('BUG: Offset pagination duplicates', () => {
    it('should not show duplicates when new posts arrive during scrolling', async () => {
      const user = await createUser('user1', 'u1@test.com');
      const token = await login('u1@test.com');
      
      // Create initial posts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${token}`)
          .send({ content: `Post ${i}` });
      }
      
      // Get first page (offset 0, limit 2)
      const page1 = await request(app)
        .get('/api/posts/feed?offset=0&limit=2')
        .set('Authorization', `Bearer ${token}`);
      
      const firstPostIds = page1.body.posts.map((p: any) => p.id);
      expect(firstPostIds).toHaveLength(2);
      
      // New post arrives between page 1 and page 2
      await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'New interrupting post' });
      
      // Get second page (offset 2, limit 2)
      const page2 = await request(app)
        .get('/api/posts/feed?offset=2&limit=2')
        .set('Authorization', `Bearer ${token}`);
      
      // BUG: With offset pagination, the new post shifts everything,
      // so we might see a duplicate from page 1
      const secondPostIds = page2.body.posts.map((p: any) => p.id);
      const duplicates = firstPostIds.filter((id: string) => secondPostIds.includes(id));
      
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('Features', () => {
    it('should create and retrieve posts', async () => {
      const user = await createUser('alice', 'alice@test.com');
      const token = await login('alice@test.com');
      
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello!' });
      
      expect(res.status).toBe(201);
      expect(res.body.content).toBe('Hello!');
    });

    it('should like a post', async () => {
      const user = await createUser('bob', 'bob@test.com');
      const token = await login('bob@test.com');
      
      const post = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Like me' });
      
      const like = await request(app)
        .post(`/api/posts/${post.body.id}/like`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(like.status).toBe(200);
      expect(like.body.liked).toBe(true);
    });
  });
});
