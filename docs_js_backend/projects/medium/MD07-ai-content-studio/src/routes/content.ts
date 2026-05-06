import { Router } from 'express';
import { pool } from '../db.js';
import { streamCompletion } from '../services/llm.js';
import { moderatePrompt } from '../middleware/moderation.js';
import type { Request, Response } from 'express';

const router = Router();

router.post('/generate', moderatePrompt, async (req: Request, res: Response) => {
  const { prompt, max_tokens = 256, temperature = 0.7 } = req.body;
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  // Rate limit by tokens (simple check)
  const requestedTokens = Math.min(4096, Math.max(1, parseInt(max_tokens) || 256));
  const tokenUsageResult = await pool.query(
    `SELECT COALESCE(SUM(tokens_used), 0) as total FROM contents WHERE created_at > NOW() - INTERVAL '1 hour'`
  );
  const hourlyTokens = parseInt(tokenUsageResult.rows[0].total);
  const HOURLY_TOKEN_LIMIT = parseInt(process.env.HOURLY_TOKEN_LIMIT || '100000');

  if (hourlyTokens + requestedTokens > HOURLY_TOKEN_LIMIT) {
    res.status(429).json({ error: 'Token rate limit exceeded. Try again later.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';
  let tokenCount = 0;

  try {
    for await (const chunk of streamCompletion(prompt, requestedTokens, temperature)) {
      fullResponse += chunk;
      tokenCount += 1; // Approximate
      res.write(`data: ${JSON.stringify({ chunk }) }\n\n`);
    }
    res.write('event: done\ndata: [DONE]\n\n');

    // Store for semantic search
    await pool.query(
      `INSERT INTO contents (prompt, response, tokens_used, moderated) VALUES ($1, $2, $3, $4)`,
      [prompt, fullResponse, tokenCount, true]
    );
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  } finally {
    res.end();
  }
});

router.post('/search', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.body;
  if (!q) {
    res.status(400).json({ error: 'q is required' });
    return;
  }

  // For testing without real embeddings, fallback to text search
  const result = await pool.query(
    `SELECT id, prompt, response, tokens_used, created_at,
      similarity(prompt, $1) as score
     FROM contents
     WHERE prompt % $1
     ORDER BY score DESC
     LIMIT $2`,
    [q, Math.min(50, parseInt(limit as string) || 10)]
  );

  res.json({ results: result.rows });
});

export default router;
