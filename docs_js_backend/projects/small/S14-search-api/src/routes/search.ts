import { Router } from 'express';
import { pool } from '../db.js';
import type { Request, Response } from 'express';

const router = Router();

router.post('/index', async (req: Request, res: Response) => {
  const { title, content } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'title and content are required' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO documents (title, content, search_vector)
     VALUES ($1, $2, to_tsvector('english', $1 || ' ' || $2))
     RETURNING id, title, content, created_at`,
    [title, content]
  );

  res.status(201).json({ document: result.rows[0] });
});

// CORRECT: Full-text search with tsvector, ranking, pagination, and highlighting
router.get('/search', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const offset = (page - 1) * limit;

  if (!q || q.trim().length === 0) {
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }

  // Use plainto_tsquery for safe query parsing (prevents SQL injection)
  const result = await pool.query(
    `SELECT 
      id,
      title,
      content,
      ts_rank_cd(search_vector, plainto_tsquery('english', $1), 32) as rank,
      ts_headline('english', content, plainto_tsquery('english', $1), 
        'MaxFragments=3, MaxWords=50, MinWords=10, StartSel=<mark>, StopSel=</mark>'
      ) as highlighted
    FROM documents
    WHERE search_vector @@ plainto_tsquery('english', $1)
    ORDER BY rank DESC
    LIMIT $2 OFFSET $3`,
    [q, limit, offset]
  );

  const totalResult = await pool.query(
    `SELECT COUNT(*) as total FROM documents WHERE search_vector @@ plainto_tsquery('english', $1)`,
    [q]
  );

  res.json({
    results: result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      rank: parseFloat(r.rank),
      highlights: r.highlighted ? [r.highlighted] : [],
    })),
    pagination: {
      page,
      limit,
      total: parseInt(totalResult.rows[0].total),
      pages: Math.ceil(parseInt(totalResult.rows[0].total) / limit),
    },
  });
});

// BUGGY: Demonstrates ILIKE instead of tsvector (slow on large data)
router.get('/search-slow', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  // Intentionally slow: ILIKE causes full table scan, no stemming, no ranking
  const result = await pool.query(
    `SELECT id, title, content, 0 as rank, ARRAY[]::text[] as highlights
     FROM documents
     WHERE content ILIKE '%' || $1 || '%'`,
    [q]
  );
  res.json({ results: result.rows, pagination: { page: 1, limit: result.rowCount, total: result.rowCount, pages: 1 } });
});

// BUGGY: Demonstrates SQL injection vulnerability via raw query concatenation
router.get('/search-unsafe', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  // WARNING: Intentionally unsafe - DO NOT USE IN PRODUCTION
  // This demonstrates SQL injection risk when user input is concatenated directly
  const result = await pool.query(
    `SELECT id, title, content, 0 as rank, ARRAY[]::text[] as highlights
     FROM documents
     WHERE search_vector @@ to_tsquery('english', '${q}')`
  );
  res.json({ results: result.rows });
});

export default router;
