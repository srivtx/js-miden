import { Request, Response } from 'express';
import { dispatch } from './services/dispatcher.js';
import { getUserPreferences, setUserPreferences } from './services/preferences.js';

export async function sendNotification(req: Request, res: Response) {
  try {
    const { userId, channels, template, vars } = req.body;
    if (!userId || !template) return res.status(400).json({ error: 'userId and template required' });

    const result = await dispatch(userId, channels || ['email', 'sms', 'push', 'inapp'], template, vars || {});
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Dispatch failed' });
  }
}

export async function getPreferences(req: Request, res: Response) {
  try {
    const prefs = await getUserPreferences(req.params.userId);
    return res.json(prefs);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get preferences' });
  }
}

export async function updatePreferences(req: Request, res: Response) {
  try {
    await setUserPreferences(req.params.userId, req.body);
    return res.json({ message: 'Preferences updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
}
