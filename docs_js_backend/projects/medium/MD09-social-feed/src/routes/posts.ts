import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { posts, userFeeds, likes, retweets, users } from '../db.js';
import { config } from '../config.js';
import type { Post } from '../types.js';

const router = Router();

function fanOutPost(post: Post) {
  // BUG: Synchronous fan-out blocks post creation
  // For each follower, add post to their feed
  const allUsers = Array.from(users.values());
  for (const user of allUsers) {
    const feed = userFeeds.get(user.id) || [];
    feed.unshift(post.id);
    userFeeds.set(user.id, feed);
  }
}

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { content } = req.body;
  const authorId = req.userId!;
  const id = crypto.randomUUID();
  const post: Post = {
    id,
    authorId,
    content,
    likes: 0,
    retweets: 0,
    createdAt: new Date(),
  };
  posts.set(id, post);
  
  // BUG: Blocking fan-out
  fanOutPost(post);
  
  res.status(201).json(post);
});

router.get('/feed', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.userId!;
  // BUG: Offset pagination causes duplicates when new posts arrive
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = parseInt(req.query.limit as string) || config.feedLimit;
  
  const feed = userFeeds.get(userId) || [];
  const paginated = feed.slice(offset, offset + limit);
  const result = paginated.map(id => posts.get(id)).filter(Boolean);
  
  res.json({
    posts: result,
    offset,
    limit,
    total: feed.length,
  });
});

router.post('/:id/like', authMiddleware, (req: AuthRequest, res) => {
  const postId = req.params.id;
  const userId = req.userId!;
  const key = `${postId}:${userId}`;
  
  if (likes.has(key)) {
    res.status(400).json({ error: 'Already liked' });
    return;
  }
  
  likes.add(key);
  const post = posts.get(postId);
  if (post) post.likes++;
  res.json({ liked: true });
});

router.post('/:id/retweet', authMiddleware, (req: AuthRequest, res) => {
  const postId = req.params.id;
  const userId = req.userId!;
  const key = `${postId}:${userId}`;
  
  if (retweets.has(key)) {
    res.status(400).json({ error: 'Already retweeted' });
    return;
  }
  
  retweets.add(key);
  const post = posts.get(postId);
  if (post) post.retweets++;
  res.json({ retweeted: true });
});

export { router as postsRouter };
