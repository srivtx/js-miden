import { PrismaClient, StrokeType } from '@prisma/client';
import { getOrCreateRoom, broadcastToRoom } from './roomService.js';

const prisma = new PrismaClient();

export interface StrokeData {
  strokeId: string;
  roomId: string;
  userId: string;
  type: StrokeType;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export class WhiteboardService {
  // BUG 1: No conflict resolution
  // Sequence number uses client timestamp instead of server monotonic counter
  async addStroke(data: StrokeData): Promise<bigint> {
    const room = getOrCreateRoom(data.roomId);

    // VULNERABILITY: Using timestamp as sequence instead of atomic counter
    const sequence = BigInt(Date.now());

    const stroke = await prisma.stroke.create({
      data: {
        id: data.strokeId,
        roomId: data.roomId,
        userId: data.userId,
        type: data.type,
        points: data.points as any,
        color: data.color,
        width: data.width,
        sequence,
      },
    });

    room.strokes.set(data.strokeId, stroke);
    room.sequence = sequence;

    broadcastToRoom(data.roomId, {
      type: 'stroke:ended',
      strokeId: data.strokeId,
      sequence: sequence.toString(),
    });

    return sequence;
  }

  async addStrokePoint(strokeId: string, roomId: string, x: number, y: number, userId: string) {
    broadcastToRoom(
      roomId,
      { type: 'stroke:point', strokeId, x, y },
      userId
    );
  }

  async broadcastCursor(roomId: string, userId: string, x: number, y: number, color: string) {
    broadcastToRoom(
      roomId,
      { type: 'cursor:moved', userId, x, y, color },
      userId
    );
  }
}

export const whiteboardService = new WhiteboardService();
