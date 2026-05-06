import { Router, Request, Response } from 'express';
import db from './db.js';
import { saveFile, readFile, deleteFile } from './storage.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const EXPIRY_MS = 24 * 60 * 60 * 1000;

// Upload file
router.post('/upload', (req: Request, res: Response) => {
  if (!req.body.file) return res.status(400).json({ error: 'Missing file base64' });
  if (!req.body.filename) return res.status(400).json({ error: 'Missing filename' });

  const buffer = Buffer.from(req.body.file, 'base64');
  const originalName: string = req.body.filename;
  const token = uuidv4();
  const expiresAt = Date.now() + EXPIRY_MS;

  const storageKey = saveFile(buffer, originalName);

  db.prepare(
    'INSERT INTO files (token, original_name, storage_key, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, originalName, storageKey, expiresAt);

  res.status(201).json({ token, expires_at: new Date(expiresAt).toISOString() });
});

// Download via token
router.get('/download/:token', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM files WHERE token = ?').get(req.params.token) as
    | { token: string; original_name: string; storage_key: string; expires_at: number; download_count: number }
    | undefined;

  if (!row) return res.status(404).json({ error: 'Not found' });

  // BUG: Expiration was only checked at generation time. We are NOT checking here,
  // so the link works forever even after 24 hours.

  const buffer = readFile(row.storage_key);
  db.prepare('UPDATE files SET download_count = download_count + 1 WHERE token = ?').run(req.params.token);

  res.setHeader('Content-Disposition', `attachment; filename="${row.original_name}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(buffer);
});

// Get file info
router.get('/info/:token', (req: Request, res: Response) => {
  const row = db.prepare('SELECT token, original_name, expires_at, download_count FROM files WHERE token = ?').get(req.params.token);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

export default router;
