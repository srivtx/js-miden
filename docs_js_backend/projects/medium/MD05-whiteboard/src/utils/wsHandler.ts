import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { joinRoom, leaveRoom, getRoomState, broadcastToRoom } from './services/roomService.js';
import { whiteboardService } from './services/whiteboardService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WSMessage {
  type: string;
  roomId: string;
  [key: string]: any;
}

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    let userId: string | null = null;
    let roomId: string | null = null;
    let userName: string = 'Anonymous';
    let userColor: string = '#3B82F6';

    ws.on('message', async (data: Buffer) => {
      try {
        const msg: WSMessage = JSON.parse(data.toString());

        if (msg.type === 'auth') {
          const payload = jwt.verify(msg.token, process.env.JWT_SECRET!) as {
            userId: string;
            roomId: string;
          };
          userId = payload.userId;
          roomId = payload.roomId;

          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user) {
            userName = user.name || 'Anonymous';
            userColor = user.color;
          }

          joinRoom(roomId, userId, ws, userName, userColor);
          const state = getRoomState(roomId);
          ws.send(JSON.stringify({ type: 'room:state', ...state }));
          broadcastToRoom(roomId, { type: 'user:joined', userId, name: userName, color: userColor });
          return;
        }

        if (!userId || !roomId) return;

        switch (msg.type) {
          case 'stroke:start': {
            broadcastToRoom(roomId, {
              type: 'stroke:started',
              strokeId: msg.strokeId,
              userId,
              type: msg.strokeType,
              color: msg.color,
              width: msg.width,
            });
            break;
          }
          case 'stroke:point': {
            await whiteboardService.addStrokePoint(msg.strokeId, roomId, msg.x, msg.y, userId);
            break;
          }
          case 'stroke:end': {
            await whiteboardService.addStroke({
              strokeId: msg.strokeId,
              roomId,
              userId,
              type: msg.strokeType,
              points: msg.points,
              color: msg.color,
              width: msg.width,
            });
            break;
          }
          case 'cursor:move': {
            await whiteboardService.broadcastCursor(roomId, userId, msg.x, msg.y, userColor);
            break;
          }
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: (err as Error).message }));
      }
    });

    ws.on('close', () => {
      if (userId && roomId) {
        leaveRoom(roomId, userId);
        broadcastToRoom(roomId, { type: 'user:left', userId });
      }
    });
  });
}
