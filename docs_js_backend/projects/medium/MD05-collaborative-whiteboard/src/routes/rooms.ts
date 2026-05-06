import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.post('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { name, description } = req.body;
    const room = await prisma.room.create({
      data: { name, description },
    });
    await prisma.roomMember.create({
      data: { roomId: room.id, userId: req.userId!, role: 'ADMIN' },
    });
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

router.get('/', authMiddleware, async (_req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { members: { include: { user: { select: { id: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        members: { include: { user: { select: { id: true, name: true, color: true } } } },
        strokes: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json(room);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/join', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const roomId = req.params.id;
    const existing = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: req.userId! } },
    });
    if (!existing) {
      await prisma.roomMember.create({
        data: { roomId, userId: req.userId!, role: 'EDITOR' },
      });
    }
    // Return a short-lived WS token
    const jwt = await import('jsonwebtoken');
    const wsToken = jwt.default.sign({ userId: req.userId!, roomId }, process.env.JWT_SECRET!, {
      expiresIn: '1h',
    });
    res.json({ wsToken });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/replay', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const session = await prisma.session.findFirst({
      where: { roomId: req.params.id },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) {
      res.status(404).json({ error: 'No replay available' });
      return;
    }
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/strokes', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const strokes = await prisma.stroke.findMany({
      where: { roomId: req.params.id },
      orderBy: { sequence: 'asc' },
    });
    res.json(strokes);
  } catch (err) {
    next(err);
  }
});

export default router;
