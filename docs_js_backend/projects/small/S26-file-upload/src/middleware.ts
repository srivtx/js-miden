import { Request, Response, NextFunction } from 'express';
import { fileTypeFromFile } from 'file-type';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function validateFileType(req: Request, res: Response, next: NextFunction) {
  if (!req.file) return next();
  const type = await fileTypeFromFile(req.file.path);
  if (!type || !ALLOWED_TYPES.includes(type.mime)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  next();
}
