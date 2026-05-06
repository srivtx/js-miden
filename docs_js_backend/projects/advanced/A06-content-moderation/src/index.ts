import express, { Request, Response } from 'express';
import { contentRouter, submitContent } from './content.js';
import { aiCheck } from './ai-check.js';
import { addToHumanReviewQueue, humanReview, getPendingReviews } from './human-review.js';
import { createAppeal, processAppeal, getAppeals } from './appeal.js';
import { publishContent } from './publish.js';
import { getAuditTrail } from './audit.js';
import { enqueueJob, getNextJob, markJobProcessing, markJobCompleted, markJobFailed } from './queue.js';
import { storage } from './storage.js';

const app = express();
app.use(express.json());

app.use('/content', contentRouter);

// Pipeline: AI Check
app.post('/content/:id/ai-check', async (req: Request, res: Response) => {
  try {
    const result = await aiCheck(req.params.id);
    if (result.result.flagged) {
      await addToHumanReviewQueue(req.params.id);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Human Review
app.get('/reviews/pending', async (_req: Request, res: Response) => {
  const items = await getPendingReviews();
  res.json(items);
});

app.post('/content/:id/review', async (req: Request, res: Response) => {
  try {
    const { reviewerId, decision, reason } = req.body;
    if (!reviewerId || !decision) {
      return res.status(400).json({ error: 'reviewerId and decision are required' });
    }
    const content = await humanReview(req.params.id, reviewerId, decision, reason || '');
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Appeals
app.post('/content/:id/appeal', async (req: Request, res: Response) => {
  try {
    const { userId, reason } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ error: 'userId and reason are required' });
    }
    const appeal = await createAppeal(req.params.id, userId, reason);
    res.status(201).json(appeal);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/appeals/:id/process', async (req: Request, res: Response) => {
  try {
    const { resolverId, approved } = req.body;
    if (!resolverId || typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'resolverId and approved are required' });
    }
    const appeal = await processAppeal(req.params.id, resolverId, approved);
    if (!appeal) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    res.json(appeal);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/content/:id/appeals', async (req: Request, res: Response) => {
  const appeals = await getAppeals(req.params.id);
  res.json(appeals);
});

// Audit
app.get('/content/:id/audit', async (req: Request, res: Response) => {
  const trail = await getAuditTrail(req.params.id);
  res.json(trail);
});

// Publish
app.post('/content/:id/publish', async (req: Request, res: Response) => {
  try {
    const content = await publishContent(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    res.json(content);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Queue
app.post('/queue/enqueue', async (req: Request, res: Response) => {
  try {
    const { type, contentId } = req.body;
    const job = await enqueueJob(type, contentId);
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/queue/next', async (_req: Request, res: Response) => {
  const job = await getNextJob();
  res.json(job);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default app;

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Content Moderation Pipeline running on port ${PORT}`);
  });
}
