import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface Post {
  id: string;
  authorId: string;
  type: 'text' | 'image' | 'video' | 'story';
  content: string;
  mediaUrls: string[];
  createdAt: string;
  expiresAt?: string;
}

export interface Like {
  id: string;
  userId: string;
  postId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  postId: string;
  content: string;
  createdAt: string;
}

export interface Share {
  id: string;
  userId: string;
  postId: string;
  createdAt: string;
}

const posts: Map<string, Post> = new Map();
const likes: Map<string, Like> = new Map();
const comments: Map<string, Comment> = new Map();
const shares: Map<string, Share> = new Map();

function getUserId(req: any): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    return payload.userId;
  } catch {
    return null;
  }
}

const router = Router();

router.post('/', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { type, content, mediaUrls } = req.body;
    if (!type || !content) return res.status(400).json({ error: 'Missing fields' });
    const id = uuidv4();
    const post: Post = {
      id,
      authorId: userId,
      type,
      content,
      mediaUrls: mediaUrls || [],
      createdAt: new Date().toISOString(),
    };
    if (type === 'story') {
      const expires = new Date();
      expires.setHours(expires.getHours() + 24);
      post.expiresAt = expires.toISOString();
    }
    posts.set(id, post);
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const list = Array.from(posts.values())
      .filter((p) => {
        if (p.type === 'story' && p.expiresAt && new Date(p.expiresAt) < new Date()) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const post = posts.get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.type === 'story' && post.expiresAt && new Date(post.expiresAt) < new Date()) {
      return res.status(404).json({ error: 'Story expired' });
    }
    res.json(post);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const post = posts.get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== userId) return res.status(403).json({ error: 'Forbidden' });
    posts.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/like', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const postId = req.params.id;
    if (!posts.has(postId)) return res.status(404).json({ error: 'Post not found' });
    const existing = Array.from(likes.values()).find((l) => l.userId === userId && l.postId === postId);
    if (existing) return res.status(400).json({ error: 'Already liked' });
    const like: Like = { id: uuidv4(), userId, postId, createdAt: new Date().toISOString() };
    likes.set(like.id, like);
    res.status(201).json(like);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/like', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const postId = req.params.id;
    const like = Array.from(likes.values()).find((l) => l.userId === userId && l.postId === postId);
    if (!like) return res.status(404).json({ error: 'Like not found' });
    likes.delete(like.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/likes', (req, res, next) => {
  try {
    const list = Array.from(likes.values()).filter((l) => l.postId === req.params.id);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/comment', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const postId = req.params.id;
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    if (!posts.has(postId)) return res.status(404).json({ error: 'Post not found' });
    const comment: Comment = { id: uuidv4(), userId, postId, content, createdAt: new Date().toISOString() };
    comments.set(comment.id, comment);
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/comments', (req, res, next) => {
  try {
    const list = Array.from(comments.values())
      .filter((c) => c.postId === req.params.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/share', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const postId = req.params.id;
    if (!posts.has(postId)) return res.status(404).json({ error: 'Post not found' });
    const share: Share = { id: uuidv4(), userId, postId, createdAt: new Date().toISOString() };
    shares.set(share.id, share);
    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
});

export { posts, likes, comments, shares };
export default router;
