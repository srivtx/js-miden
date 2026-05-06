import { IceCandidateEntry, RTCIceCandidateInit, SignalingMessage } from '../types/index.js';
import { SignalingService } from './SignalingService.js';

/**
 * ICE Candidate Relay Service
 * BUG: No cleanup of ICE candidates after they are consumed or after timeout.
 * This causes memory leak as candidates accumulate forever.
 */
export class IceRelayService {
  private candidates: Map<string, IceCandidateEntry[]> = new Map();
  private relayCount = 0;

  constructor(private signalingService: SignalingService) {}

  storeCandidate(roomId: string, peerId: string, candidate: RTCIceCandidateInit): string {
    const entry: IceCandidateEntry = {
      id: `${peerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      peerId,
      candidate,
      timestamp: Date.now(),
    };

    const roomCandidates = this.candidates.get(roomId) || [];
    roomCandidates.push(entry);
    this.candidates.set(roomId, roomCandidates);

    // BUG: No cleanup of old candidates - memory leak!
    // Should remove candidates after relay or after timeout
    // this.cleanupOldCandidates(roomId);

    return entry.id;
  }

  relayCandidate(roomId: string, peerId: string, candidate: RTCIceCandidateInit, targetPeerId?: string): boolean {
    this.storeCandidate(roomId, peerId, candidate);
    this.relayCount++;

    const message: SignalingMessage = {
      type: 'ice-candidate',
      roomId,
      peerId,
      targetPeerId,
      payload: candidate,
      timestamp: Date.now(),
    };

    if (targetPeerId) {
      return this.signalingService.sendToPeer(targetPeerId, message);
    } else {
      this.signalingService.broadcastToRoom(roomId, message, peerId);
      return true;
    }
  }

  getCandidatesForRoom(roomId: string): IceCandidateEntry[] {
    return this.candidates.get(roomId) || [];
  }

  getCandidateCount(): number {
    let count = 0;
    for (const candidates of this.candidates.values()) {
      count += candidates.length;
    }
    return count;
  }

  getRelayCount(): number {
    return this.relayCount;
  }

  // This method is defined but NEVER called - the bug!
  cleanupOldCandidates(maxAgeMs = 30000): number {
    let cleaned = 0;
    const now = Date.now();
    for (const [roomId, entries] of this.candidates) {
      const filtered = entries.filter(entry => now - entry.timestamp < maxAgeMs);
      cleaned += entries.length - filtered.length;
      if (filtered.length === 0) {
        this.candidates.delete(roomId);
      } else {
        this.candidates.set(roomId, filtered);
      }
    }
    return cleaned;
  }
}