import { Request, Response } from 'express';
import { storeFile, retrieveFile } from './services/storage.js';
import { processImage } from './services/image.js';
import { scanFile } from './services/scan.js';
import path from 'path';

export async function uploadFile(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const result = await scanFile(req.file.path);
    if (!result.clean) return res.status(400).json({ error: 'Virus detected' });

    // BUG: path traversal in filename
    const filename = req.file.originalname;

    const storedPath = await storeFile(req.file.path, filename);

    if (req.file.mimetype.startsWith('image/')) {
      await processImage(storedPath);
    }

    return res.status(201).json({ path: storedPath });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}

export async function getFile(req: Request, res: Response) {
  try {
    const file = await retrieveFile(req.params.filename);
    if (!file) return res.status(404).json({ error: 'Not found' });
    return res.sendFile(path.resolve(file));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve file' });
  }
}
