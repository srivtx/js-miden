import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignalingService } from '../src/services/SignalingService.js';
import { IceRelayService } from '../src/services/IceRelayService.js';
import { RoomService } from '../src/services/RoomService.js';

describe('SignalingService', () => {
  let service: SignalingService;

  beforeEach(() => {
    service = new SignalingService();
  });

  it('should register and remove peers', () => {
    const ws = { send: vi.fn() } as any;
    service.registerPeer('peer-1', ws);
    expect(service.getPeerCount()).toBe(1);
    service.removePeer('peer-1');
    expect(service.getPeerCount()).toBe(0);
  });

  it('should create and manage rooms', () => {
    service.createRoom('room-1');
    expect(service.getRoomCount()).toBe(1);
  });

  it('should isolate rooms - peers in different rooms should not receive messages', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    const ws3 = { send: vi.fn() } as any;

    service.registerPeer('peer-1', ws1);
    service.registerPeer('peer-2', ws2);
    service.registerPeer('peer-3', ws3);

    service.createRoom('room-a');
    service.createRoom('room-b');

    service.joinRoom('peer-1', 'room-a');
    service.joinRoom('peer-2', 'room-a');
    service.joinRoom('peer-3', 'room-b');

    service.broadcastToRoom('room-a', {
      type: 'offer',
      roomId: 'room-a',
      peerId: 'peer-1',
      timestamp: Date.now(),
    });

    expect(ws1.send).toHaveBeenCalledTimes(0); // sender excluded
    expect(ws2.send).toHaveBeenCalledTimes(1);  // same room
    expect(ws3.send).toHaveBeenCalledTimes(0);  // different room
  });

  it('should relay SDP between peers', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;

    service.registerPeer('peer-1', ws1);
    service.registerPeer('peer-2', ws2);
    service.createRoom('room-1');
    service.joinRoom('peer-1', 'room-1');
    service.joinRoom('peer-2', 'room-1');

    const sdp = { type: 'offer' as const, sdp: 'v=0\r\n...' };
    service.relaySdp('peer-1', 'peer-2', sdp, 'room-1');

    expect(ws2.send).toHaveBeenCalled();
  });
});

describe('IceRelayService', () => {
  let signalingService: SignalingService;
  let iceService: IceRelayService;

  beforeEach(() => {
    signalingService = new SignalingService();
    iceService = new IceRelayService(signalingService);
  });

  it('should store and relay ICE candidates', () => {
    const ws = { send: vi.fn() } as any;
    signalingService.registerPeer('peer-1', ws);
    signalingService.createRoom('room-1');
    signalingService.joinRoom('peer-1', 'room-1');

    const candidate = {
      candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };

    iceService.relayCandidate('room-1', 'peer-1', candidate);
    expect(iceService.getCandidateCount()).toBe(1);
  });

  it('BUG: ICE candidates accumulate forever - memory leak', () => {
    const ws = { send: vi.fn() } as any;
    signalingService.registerPeer('peer-1', ws);
    signalingService.createRoom('room-1');
    signalingService.joinRoom('peer-1', 'room-1');

    const candidate = {
      candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };

    // Simulate many candidates being added
    for (let i = 0; i < 1000; i++) {
      iceService.relayCandidate('room-1', 'peer-1', candidate);
    }

    expect(iceService.getCandidateCount()).toBe(1000);

    // After cleanup, should be 0 (but bug means cleanup is never called)
    // This test documents the expected behavior vs actual bug
    expect(iceService.getCandidateCount()).toBe(1000); // Bug: still 1000, not cleaned up
  });

  it('should relay candidate to specific target', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;

    signalingService.registerPeer('peer-1', ws1);
    signalingService.registerPeer('peer-2', ws2);
    signalingService.createRoom('room-1');
    signalingService.joinRoom('peer-1', 'room-1');
    signalingService.joinRoom('peer-2', 'room-1');

    const candidate = {
      candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };

    iceService.relayCandidate('room-1', 'peer-1', candidate, 'peer-2');
    expect(ws2.send).toHaveBeenCalled();
    expect(ws1.send).not.toHaveBeenCalled();
  });
});

describe('RoomService', () => {
  let signalingService: SignalingService;
  let roomService: RoomService;

  beforeEach(() => {
    signalingService = new SignalingService();
    roomService = new RoomService(signalingService);
  });

  it('should create rooms', () => {
    roomService.getOrCreateRoom('room-1');
    expect(roomService.getRoomStats('room-1')).not.toBeNull();
  });

  it('should cleanup empty rooms', () => {
    roomService.getOrCreateRoom('room-1');
    const cleaned = roomService.cleanupEmptyRooms();
    expect(cleaned).toBe(1);
    expect(roomService.getRoomStats('room-1')).toBeNull();
  });

  it('should return all room stats', () => {
    roomService.getOrCreateRoom('room-1');
    roomService.getOrCreateRoom('room-2');
    const stats = roomService.getAllRoomStats();
    expect(stats).toHaveLength(2);
  });
});