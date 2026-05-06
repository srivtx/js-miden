import { SignalingMessage, Peer, Room, RTCSessionDescriptionInit, RTCIceCandidateInit } from '../types/index.js';

export class SignalingService {
  private peers: Map<string, Peer> = new Map();
  private rooms: Map<string, Room> = new Map();

  registerPeer(peerId: string, ws: WebSocket): Peer {
    const peer: Peer = {
      id: peerId,
      ws,
      roomId: null,
      connectedAt: Date.now(),
    };
    this.peers.set(peerId, peer);
    return peer;
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer && peer.roomId) {
      this.leaveRoom(peerId, peer.roomId);
    }
    this.peers.delete(peerId);
  }

  createRoom(roomId: string, maxPeers = 8): Room {
    const room: Room = {
      id: roomId,
      peers: new Set(),
      createdAt: Date.now(),
      maxPeers,
    };
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(peerId: string, roomId: string): boolean {
    const peer = this.peers.get(peerId);
    const room = this.rooms.get(roomId);
    if (!peer || !room) return false;
    if (room.peers.size >= room.maxPeers) return false;

    room.peers.add(peerId);
    peer.roomId = roomId;

    // Notify existing peers
    this.broadcastToRoom(roomId, {
      type: 'join',
      roomId,
      peerId,
      timestamp: Date.now(),
    }, peerId);

    return true;
  }

  leaveRoom(peerId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.peers.delete(peerId);
      if (room.peers.size === 0) {
        this.rooms.delete(roomId);
      }
    }
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.roomId = null;
    }

    this.broadcastToRoom(roomId, {
      type: 'leave',
      roomId,
      peerId,
      timestamp: Date.now(),
    });
  }

  sendToPeer(peerId: string, message: SignalingMessage): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) return false;
    peer.ws.send(JSON.stringify(message));
    return true;
  }

  broadcastToRoom(roomId: string, message: SignalingMessage, excludePeerId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const peerId of room.peers) {
      if (excludePeerId && peerId === excludePeerId) continue;
      this.sendToPeer(peerId, message);
    }
  }

  relaySdp(peerId: string, targetPeerId: string, sdp: RTCSessionDescriptionInit, roomId: string): boolean {
    const peer = this.peers.get(peerId);
    const target = this.peers.get(targetPeerId);
    if (!peer || !target || peer.roomId !== roomId || target.roomId !== roomId) {
      return false;
    }

    return this.sendToPeer(targetPeerId, {
      type: sdp.type === 'offer' ? 'offer' : 'answer',
      roomId,
      peerId,
      targetPeerId,
      payload: sdp,
      timestamp: Date.now(),
    });
  }

  getRoomPeers(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.peers);
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}