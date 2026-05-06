import { Request, Response } from 'express';
import { createShortCode, getUrlByShortCode, recordClick } from './services/shortener.js';
import { getAnalyticsForCode } from './services/analytics.js';

export async function createShortUrl(req: Request, res: Response) {
  try {
    const { url, customCode, expiresInDays } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const shortCode = await createShortCode(url, customCode, expiresInDays ? parseInt(expiresInDays) : undefined);
    return res.status(201).json({ shortCode, url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create short URL' });
  }
}

export async function redirectShortUrl(req: Request, res: Response) {
  try {
    const { shortCode } = req.params;
    const entry = await getUrlByShortCode(shortCode);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      return res.status(410).json({ error: 'Expired' });
    }
    await recordClick(shortCode, req.headers.referer as string, req.ip);
    return res.redirect(entry.url);
  } catch (err) {
    return res.status(500).json({ error: 'Redirect failed' });
  }
}

export async function getAnalytics(req: Request, res: Response) {
  try {
    const stats = await getAnalyticsForCode(req.params.shortCode);
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: 'Analytics failed' });
  }
}
