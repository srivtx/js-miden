import { Router, Request, Response } from 'express';
import db from './db.js';

const router = Router();

// Create poll
router.post('/', (req: Request, res: Response) => {
  const { question, options } = req.body as { question: string; options: string[] };
  const pollResult = db.prepare('INSERT INTO polls (question) VALUES (?)').run(question);
  const pollId = pollResult.lastInsertRowid as number;
  const insertOption = db.prepare('INSERT INTO options (poll_id, text) VALUES (?, ?)');
  for (const text of options) {
    insertOption.run(pollId, text);
  }
  res.status(201).json({ id: pollId });
});

// Get poll results
router.get('/:id/results', (req: Request, res: Response) => {
  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  const options = db.prepare('SELECT id, text, count FROM options WHERE poll_id = ?').all(req.params.id);
  res.json({ poll, options });
});

// Vote on option
router.post('/:id/vote', (req: Request, res: Response) => {
  const { option_id } = req.body as { option_id: number };
  const pollId = req.params.id;
  const ip = req.ip || 'unknown';

  // Duplicate vote check by IP
  const existing = db.prepare('SELECT id FROM votes WHERE poll_id = ? AND ip = ?').get(pollId, ip);
  if (existing) {
    return res.status(403).json({ error: 'Already voted from this IP' });
  }

  // BUG: Race condition here. Read count, increment, write back.
  // Under concurrent load, votes can be lost.
  const row = db.prepare('SELECT count FROM options WHERE id = ? AND poll_id = ?').get(option_id, pollId) as { count: number } | undefined;
  if (!row) return res.status(404).json({ error: 'Option not found' });

  const newCount = row.count + 1;
  db.prepare('UPDATE options SET count = ? WHERE id = ?').run(newCount, option_id);
  db.prepare('INSERT INTO votes (poll_id, option_id, ip) VALUES (?, ?, ?)').run(pollId, option_id, ip);

  res.json({ voted: true, count: newCount });
});

// SSE stream for real-time results
router.get('/:id/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendResults = () => {
    const options = db.prepare('SELECT id, text, count FROM options WHERE poll_id = ?').all(req.params.id);
    res.write(`data: ${JSON.stringify({ options })}\n\n`);
  };

  sendResults();
  const interval = setInterval(sendResults, 2000);

  // BUG: Connection cleanup may be missed in some disconnect scenarios
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

export default router;
