import { Router } from 'express';
import { signalingService, roomService, iceRelayService, presenceService } from '../index.js';

export const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    peers: signalingService.getPeerCount(),
    rooms: signalingService.getRoomCount(),
    iceCandidates: iceRelayService.getCandidateCount(),
  });
});

router.get('/rooms/:roomId', (req, res) => {
  const stats = roomService.getRoomStats(req.params.roomId);
  if (!stats) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({
    ...stats,
    peers: signalingService.getRoomPeers(req.params.roomId),
    presence: presenceService.getPresenceInRoom(req.params.roomId),
  });
});

router.get('/rooms', (req, res) => {
  res.json(roomService.getAllRoomStats());
});

router.get('/ice/candidates', (req, res) => {
  res.json({
    totalCandidates: iceRelayService.getCandidateCount(),
    totalRelays: iceRelayService.getRelayCount(),
  });
});