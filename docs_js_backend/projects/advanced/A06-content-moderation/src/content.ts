import { Router, Request, Response } from 'express';
import { storage } from './storage.js';

export interface ContentItem {
  id: string;
  userId: string;
  text: string;
  status: 'submitted' | 'ai_review' | 'human_review' | 'approved' | 'rejected' | 'published';
  submittedAt: number;
  aiResult?: AIResult;
  humanDecision?: HumanDecision;
  publishedAt?: number;
}

export interface ContentBody {
  userId: string;
  text: string;
}

export interface AIResult {
  flagged: boolean;
  categories: string[];
  confidence: number;
  checkedAt: number;
}

export interface HumanDecision {
  reviewerId: string;
  decision: 'approved' | 'rejected';
  reason: string;
  decidedAt: number;
}

const router = Router();

export async function submitContent(body: ContentBody): Promise<ContentItem> {
  const content: ContentItem = {
    id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: body.userId,
    text: body.text,
    status: 'submitted',
    submittedAt: Date.now(),
  };
  await storage.saveContent(content);
  return content;
}

export async function getContent(id: string): Promise<ContentItem | null> {
  return storage.getContent(id);
}

export async function listContent(): Promise<ContentItem[]> {
  return storage.getAllContent();
}

export async function updateContentStatus(id: string, status: ContentItem['status']): Promise<ContentItem | null> {
  return storage.updateContent(id, { status });
}

router.post('/submit', async (req: Request, res: Response) => {
  try {
    const body = req.body as ContentBody;
    if (!body.userId || !body.text) {
      return res.status(400).json({ error: 'userId and text are required' });
    }
    const content = await submitContent(body);
    res.status(201).json(content);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  const items = await listContent();
  res.json(items);
});

router.get('/:id', async (req: Request, res: Response) => {
  const content = await getContent(req.params.id);
  if (!content) {
    return res.status(404).json({ error: 'Content not found' });
  }
  res.json(content);
});

export default router;
export { router as contentRouter };
