import { Router, type Request, type Response } from 'express';
import { db } from './db.js';

export const router = Router();

router.post('/posts', (req: Request, res: Response) => {
  const { title, content } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'title and content required' });
    return;
  }
  const stmt = db.prepare('INSERT INTO posts (title, content) VALUES (?, ?)');
  const result = stmt.run(title, content);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(post);
});

router.get('/posts', (_req: Request, res: Response) => {
  const posts = db.prepare('SELECT * FROM posts WHERE deleted_at IS NULL ORDER BY created_at DESC').all() as any[];

  // BUG: N+1 query - one query per post to count comments
  for (const post of posts) {
    const count = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(post.id) as { count: number };
    post.commentCount = count.count;
  }

  res.json(posts);
});

router.get('/posts/:id', (req: Request, res: Response) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...post, comments });
});

router.put('/posts/:id', (req: Request, res: Response) => {
  const { title, content } = req.body;
  const stmt = db.prepare('UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL');
  const result = stmt.run(title, content, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json(post);
});

router.delete('/posts/:id', (req: Request, res: Response) => {
  // Soft delete
  db.prepare('UPDATE posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

router.post('/posts/:id/comments', (req: Request, res: Response) => {
  const { content } = req.body;
  if (!content) {
    res.status(400).json({ error: 'content required' });
    return;
  }
  // BUG: No length validation on content (allows spam / huge comments)
  const stmt = db.prepare('INSERT INTO comments (post_id, content) VALUES (?, ?)');
  const result = stmt.run(req.params.id, content);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(comment);
});

router.get('/posts/:id/comments', (req: Request, res: Response) => {
  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(comments);
});
