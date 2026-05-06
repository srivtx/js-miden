import { Router, type Request, type Response } from 'express';
import { pool } from './db.js';

export const router = Router();

router.post('/notes', async (req: Request, res: Response) => {
  const { title, content } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'title and content required' });
    return;
  }
  const result = await pool.query(
    'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
    [title, content]
  );
  res.status(201).json(result.rows[0]);
});

router.get('/notes', async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
  const offset = (page - 1) * limit;

  let rows;
  let countResult;

  if (q) {
    // BUG: Direct string concatenation enables SQL injection via q parameter
    rows = await pool.query(
      `SELECT * FROM notes WHERE deleted_at IS NULL AND content ILIKE '%${q}%' ORDER BY id LIMIT ${limit} OFFSET ${offset}`
    );
    countResult = await pool.query(
      `SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL AND content ILIKE '%${q}%'`
    );
  } else {
    rows = await pool.query(
      `SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY id LIMIT ${limit} OFFSET ${offset}`
    );
    countResult = await pool.query(`SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL`);
  }

  res.json({
    data: rows.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
    },
  });
});

router.get('/notes/:id', async (req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM notes WHERE id = $1 AND deleted_at IS NULL', [
    req.params.id,
  ]);
  if (!result.rows.length) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(result.rows[0]);
});

router.put('/notes/:id', async (req: Request, res: Response) => {
  const { title, content } = req.body;
  const result = await pool.query(
    'UPDATE notes SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 AND deleted_at IS NULL RETURNING *',
    [title, content, req.params.id]
  );
  if (!result.rows.length) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(result.rows[0]);
});

router.delete('/notes/:id', async (req: Request, res: Response) => {
  // Soft delete
  await pool.query('UPDATE notes SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
  res.status(204).send();
});
