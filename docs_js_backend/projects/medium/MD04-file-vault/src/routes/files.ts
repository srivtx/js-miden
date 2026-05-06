import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { fileService } from '../services/fileService.js';
import { accessService } from '../services/accessService.js';
import { generateSignedUrl, verifySignedUrl } from '../utils/urlSigner.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const prisma = new PrismaClient();

router.post('/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const result = await fileService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.userId!
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const files = await fileService.listFiles(req.userId!);
    res.json(files);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const file = await fileService.getFile(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    const canAccess = await accessService.canRead(req.userId!, file.id);
    if (!canAccess) {
      await prisma.auditLog.create({
        data: { fileId: file.id, userId: req.userId!, action: 'ACCESS_DENIED' },
      });
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    res.json(file);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/download', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const file = await fileService.getFile(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    const canAccess = await accessService.canRead(req.userId!, file.id);
    if (!canAccess) {
      await prisma.auditLog.create({
        data: { fileId: file.id, userId: req.userId!, action: 'ACCESS_DENIED' },
      });
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const data = await fileService.downloadFile(req.params.id);
    if (!data) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    await prisma.auditLog.create({
      data: { fileId: file.id, userId: req.userId!, action: 'DOWNLOAD' },
    });

    res.setHeader('Content-Type', data.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${data.originalName}"`);
    res.send(data.buffer);
  } catch (err) {
    next(err);
  }
});

// BUG 3: No access control on signed URL generation
// Any authenticated user can generate a signed URL for ANY file by changing the fileId parameter
router.post('/:id/signed-url', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    // MISSING: Should check if user can access this file
    // const canAccess = await accessService.canRead(req.userId!, req.params.id);
    // if (!canAccess) { res.status(403)... }

    const signedUrl = generateSignedUrl(req.params.id);
    await prisma.auditLog.create({
      data: { fileId: req.params.id, userId: req.userId!, action: 'SHARE' },
    });
    res.json({ url: signedUrl, expiresIn: 3600 });
  } catch (err) {
    next(err);
  }
});

router.get('/download/:token', async (req, res, next) => {
  try {
    const payload = verifySignedUrl(req.params.token);
    if (!payload) {
      res.status(400).json({ error: 'Invalid or expired URL' });
      return;
    }

    const data = await fileService.downloadFile(payload.fileId);
    if (!data) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.setHeader('Content-Type', data.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${data.originalName}"`);
    res.send(data.buffer);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/share', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { userId, role = 'READER' } = req.body;
    const canAdmin = await accessService.canAdmin(req.userId!, req.params.id);
    if (!canAdmin) {
      res.status(403).json({ error: 'Only owner can share files' });
      return;
    }
    const access = await accessService.grantAccess(req.params.id, userId, role);
    res.json(access);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    await fileService.deleteFile(req.params.id, req.userId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/audit', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const canAccess = await accessService.canRead(req.userId!, req.params.id);
    if (!canAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const logs = await fileService.getAuditLog(req.params.id);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
