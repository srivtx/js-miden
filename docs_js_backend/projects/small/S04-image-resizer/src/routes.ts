import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_DIR = './uploads';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const id = uuidv4();
    const ext = file.originalname.split('.').pop() || 'bin';
    cb(null, `${id}.${ext}`);
  },
});

const upload = multer({ storage });

const uploads = new Map<string, { filename: string; mimetype: string }>();

export const router = Router();

router.post('/upload', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image provided' });
    return;
  }
  const id = req.file.filename.split('.')[0];
  uploads.set(id, { filename: req.file.filename, mimetype: req.file.mimetype });
  res.json({ id, filename: req.file.filename });
});

router.get('/resize/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const meta = uploads.get(id);
  if (!meta) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  const width = parseInt(req.query.width as string, 10);
  const height = parseInt(req.query.height as string, 10);

  // BUG: No validation of width/height (negative values or zero crash sharp)
  // BUG: Reads entire file into memory instead of streaming
  const filePath = join(UPLOAD_DIR, meta.filename);
  const buffer = await readFile(filePath);

  let pipeline = sharp(buffer);
  if (!Number.isNaN(width) || !Number.isNaN(height)) {
    pipeline = pipeline.resize(width || undefined, height || undefined, { fit: 'inside' });
  }

  const format = (req.query.format as string) || meta.mimetype.split('/')[1];
  if (['jpeg', 'jpg', 'png', 'webp'].includes(format)) {
    pipeline = pipeline.toFormat(format === 'jpg' ? 'jpeg' : (format as keyof sharp.FormatEnum));
  }

  const resized = await pipeline.toBuffer();
  res.set('Content-Type', `image/${format === 'jpg' ? 'jpeg' : format}`);
  res.send(resized);
});
