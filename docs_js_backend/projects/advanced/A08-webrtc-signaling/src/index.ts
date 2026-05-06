import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { SignalingService } from './services/SignalingService.js';
import { RoomService } from './services/RoomService.js';
import { IceRelayService } from './services/IceRelayService.js';
import { PresenceService } from './services/PresenceService.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use('/api', router);
app.use(errorHandler);

const signalingService = new SignalingService();
const roomService = new RoomService(signalingService);
const iceRelayService = new IceRelayService(signalingService);
const presenceService = new PresenceService(signalingService);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const peerId = url.searchParams.get('peerId') || `peer-${Date.now()}`;

  signalingService.registerPeer(peerId, ws as any);
  presenceService.updatePresence(peerId, '');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(peerId, message);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => {
    signalingService.removePeer(peerId);
    presenceService.removePresence(peerId);
  });
});

function handleMessage(peerId: string, message: any) {
  const { type, roomId, targetPeerId, payload } = message;

  switch (type) {
    case 'join':
      roomService.getOrCreateRoom(roomId);
      signalingService.joinRoom(peerId, roomId);
      presenceService.updatePresence(peerId, roomId);
      break;
    case 'leave':
      signalingService.leaveRoom(peerId, roomId);
      presenceService.removePresence(peerId);
      break;
    case 'offer':
    case 'answer':
      if (targetPeerId) {
        signalingService.relaySdp(peerId, targetPeerId, payload, roomId);
      }
      break;
    case 'ice-candidate':
      iceRelayService.relayCandidate(roomId, peerId, payload, targetPeerId);
      break;
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebRTC Signaling Server running on port ${PORT}`);
});

export { signalingService, roomService, iceRelayService, presenceService };