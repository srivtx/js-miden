import { Router, Request, Response } from 'express';
import db from './db.js';

const router = Router();

interface JobBody {
  title: string;
  company: string;
  location: string;
  salary_min: number;
  salary_max: number;
  type: 'full-time' | 'contract';
  remote: boolean;
}

// Create job
router.post('/', (req: Request, res: Response) => {
  const { title, company, location, salary_min, salary_max, type, remote } = req.body as JobBody;
  const stmt = db.prepare(
    'INSERT INTO jobs (title, company, location, salary_min, salary_max, type, remote) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(title, company, location, salary_min, salary_max, type, remote ? 1 : 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

// List jobs with filters and sorting
router.get('/', (req: Request, res: Response) => {
  const { type, remote, salary_min, salary_max, location, sort_by, order } = req.query;

  let sql = 'SELECT * FROM jobs WHERE 1=1';

  // BUG: SQL Injection vulnerability via string concatenation
  if (type) sql += ` AND type = '${type}'`;
  if (remote) sql += ` AND remote = ${remote === 'true' ? 1 : 0}`;
  if (salary_min) sql += ` AND salary_max >= ${salary_min}`;
  if (salary_max) sql += ` AND salary_min <= ${salary_max}`;
  if (location) sql += ` AND location LIKE '%${location}%'`;

  const validSort = ['posted_date', 'salary_min', 'salary_max'];
  const sortColumn = validSort.includes(sort_by as string) ? sort_by : 'posted_date';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortColumn} ${sortOrder}`;

  const jobs = db.prepare(sql).all();
  res.json(jobs);
});

// Get single job
router.get('/:id', (req: Request, res: Response) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Update job
router.patch('/:id', (req: Request, res: Response) => {
  const { title, company, location, salary_min, salary_max, type, remote } = req.body as Partial<JobBody>;
  const sets: string[] = [];
  const values: unknown[] = [];
  if (title !== undefined) { sets.push('title = ?'); values.push(title); }
  if (company !== undefined) { sets.push('company = ?'); values.push(company); }
  if (location !== undefined) { sets.push('location = ?'); values.push(location); }
  if (salary_min !== undefined) { sets.push('salary_min = ?'); values.push(salary_min); }
  if (salary_max !== undefined) { sets.push('salary_max = ?'); values.push(salary_max); }
  if (type !== undefined) { sets.push('type = ?'); values.push(type); }
  if (remote !== undefined) { sets.push('remote = ?'); values.push(remote ? 1 : 0); }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  res.json({ updated: true });
});

// Delete job
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
