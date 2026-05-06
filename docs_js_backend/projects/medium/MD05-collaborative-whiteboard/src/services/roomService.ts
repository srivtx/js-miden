import { PrismaClient, StrokeType } from '@prisma/client';
import WebSocket from 'ws';

const prisma = new PrismaClient();

// BUG 3: No persistence on server restart
// Room state is stored only in memory. On restart, active room state is lost.
interface RoomState {
  strokes: Map<string, any>;
  users: Map<string, { ws: WebSocket; userId: string; name: string; color: string }>;
  sequence: bigint;
}

const rooms = new Map<string, RoomState>();

export function getOrCreateRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      strokes: new Map(),
      users: new Map(),
      sequence: BigInt(0),
    });
  }
  return rooms.get(roomId)!;
}

export function joinRoom(roomId: string, userId: string, ws: WebSocket, name: string, color: string) {
  const room = getOrCreateRoom(roomId);
  room.users.set(userId, { ws, userId, name, color });
  return room;
}

export function leaveRoom(roomId: string, userId: string) {
  const room = rooms.get(roomId);
  if (room) {
    room.users.delete(userId);
    if (room.users.size === 0) {
      rooms.delete(roomId);
    }
  }
}

// BUG 2: Broadcast to wrong room
// Missing room filter - sends to ALL connected WebSockets
export function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
  const room = getOrCreateRoom(roomId);
  const data = JSON.stringify(message);

  // VULNERABILITY: Should be room.users.values(), but iterates over ALL rooms
  for (const roomState of rooms.values()) {
    for (const user of roomState.users.values()) {
      if (excludeUserId && user.userId === excludeUserId) continue;
      if (user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(data);
      }
    }
  }
}

export function getRoomState(roomId: string) {
  const room = getOrCreateRoom(roomId);
  return {
    strokes: Array.from(room.strokes.values()),
    users: Array.from(room.users.values()).map((u) => ({
      userId: u.userId,
      name: u.name,
      color: u.color,
    })),
  };
}
