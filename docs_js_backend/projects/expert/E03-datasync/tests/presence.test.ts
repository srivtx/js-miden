import { describe, it, expect, beforeEach } from 'vitest';
import { PresenceService } from '../src/services/PresenceService.js';

describe('PresenceService', () => {
  let presence: PresenceService;

  beforeEach(() => {
    presence = new PresenceService();
  });

  it('should track peer presence', () => {
    presence.updatePresence({
      peerId: 'peer-1',
      status: 'online',
      lastSeen: Date.now(),
    });

    expect(presence.getOnlinePeers()).toContain('peer-1');
    expect(presence.getPresence('peer-1')?.status).toBe('online');
  });

  it('should update peer status', () => {
    presence.updatePresence({
      peerId: 'peer-1',
      status: 'online',
      lastSeen: Date.now(),
    });

    presence.updatePresence({
      peerId: 'peer-1',
      status: 'away',
      lastSeen: Date.now(),
    });

    expect(presence.getPresence('peer-1')?.status).toBe('away');
  });

  it('should remove presence', () => {
    presence.updatePresence({
      peerId: 'peer-1',
      status: 'online',
      lastSeen: Date.now(),
    });

    presence.removePresence('peer-1');
    expect(presence.getPresence('peer-1')).toBeNull();
  });

  it('should cleanup stale presence', () => {
    presence.updatePresence({
      peerId: 'peer-1',
      status: 'online',
      lastSeen: Date.now() - 120000,
    });

    const cleaned = presence.cleanupStalePresence(60000);
    expect(cleaned).toBe(1);
    expect(presence.getOnlinePeers()).toHaveLength(0);
  });

  it('should notify subscribers', () => {
    const callback = vi.fn();
    const unsubscribe = presence.subscribe(callback);

    presence.updatePresence({
      peerId: 'peer-1',
      status: 'online',
      lastSeen: Date.now(),
    });

    expect(callback).toHaveBeenCalled();
    unsubscribe();
  });
});