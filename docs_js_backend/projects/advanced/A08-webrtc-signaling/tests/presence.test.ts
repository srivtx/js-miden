import { describe, it, expect, beforeEach } from 'vitest';
import { SignalingService } from '../src/services/SignalingService.js';
import { PresenceService } from '../src/services/PresenceService.js';

describe('PresenceService', () => {
  let signalingService: SignalingService;
  let presenceService: PresenceService;

  beforeEach(() => {
    signalingService = new SignalingService();
    presenceService = new PresenceService(signalingService);
  });

  it('should track peer presence', () => {
    presenceService.updatePresence('peer-1', 'room-1');
    expect(presenceService.getPresenceInRoom('room-1')).toContain('peer-1');
  });

  it('should remove presence', () => {
    presenceService.updatePresence('peer-1', 'room-1');
    presenceService.removePresence('peer-1');
    expect(presenceService.getPresenceInRoom('room-1')).not.toContain('peer-1');
  });

  it('should cleanup stale presence', () => {
    presenceService.updatePresence('peer-1', 'room-1');
    // Simulate time passing
    const now = Date.now();
    // Manually set lastSeen to 2 minutes ago
    (presenceService as any).presence.get('peer-1').lastSeen = now - 120000;

    const cleaned = presenceService.cleanupStalePresence(60000);
    expect(cleaned).toBe(1);
    expect(presenceService.getPresenceInRoom('room-1')).toHaveLength(0);
  });

  it('should handle multiple peers in same room', () => {
    presenceService.updatePresence('peer-1', 'room-1');
    presenceService.updatePresence('peer-2', 'room-1');
    presenceService.updatePresence('peer-3', 'room-2');

    expect(presenceService.getPresenceInRoom('room-1')).toHaveLength(2);
    expect(presenceService.getPresenceInRoom('room-2')).toHaveLength(1);
  });
});