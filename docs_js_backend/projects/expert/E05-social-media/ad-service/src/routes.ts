import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface AdCampaign {
  id: string;
  advertiserId: string;
  title: string;
  content: string;
  targetAudience: string[];
  budgetCents: number;
  impressions: number;
  clicks: number;
  active: boolean;
  createdAt: string;
}

const campaigns: Map<string, AdCampaign> = new Map();

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

router.post('/campaigns', (req, res, next) => {
  try {
    const advertiserId = getUserId(req);
    if (!advertiserId) return res.status(401).json({ error: 'Unauthorized' });
    const { title, content, targetAudience, budgetCents } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Missing fields' });
    const campaign: AdCampaign = {
      id: uuidv4(),
      advertiserId,
      title,
      content,
      targetAudience: targetAudience || [],
      budgetCents: budgetCents || 0,
      impressions: 0,
      clicks: 0,
      active: true,
      createdAt: new Date().toISOString(),
    };
    campaigns.set(campaign.id, campaign);
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

router.get('/campaigns', (req, res, next) => {
  try {
    const list = Array.from(campaigns.values()).filter((c) => c.active);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/impression', (req, res, next) => {
  try {
    const campaign = campaigns.get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    campaign.impressions += 1;
    campaigns.set(campaign.id, campaign);
    res.json({ impressions: campaign.impressions });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/click', (req, res, next) => {
  try {
    const campaign = campaigns.get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    campaign.clicks += 1;
    campaigns.set(campaign.id, campaign);
    res.json({ clicks: campaign.clicks });
  } catch (err) {
    next(err);
  }
});

export { campaigns };
export default router;
