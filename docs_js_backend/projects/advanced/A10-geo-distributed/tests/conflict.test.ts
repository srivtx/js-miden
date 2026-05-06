import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictResolutionService } from '../src/services/ConflictResolutionService.js';
import { RecordData } from '../src/types/index.js';

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService;

  beforeEach(() => {
    service = new ConflictResolutionService();
  });

  it('should resolve when local is newer', () => {
    const local: RecordData = {
      id: 'record-1',
      value: { name: 'Alice' },
      timestamp: Date.now(),
      region: 'us-east',
      vectorClock: { 'us-east': 2 },
      version: 2,
    };

    const remote: RecordData = {
      id: 'record-1',
      value: { name: 'Bob' },
      timestamp: Date.now() - 1000,
      region: 'us-west',
      vectorClock: { 'us-west': 1 },
      version: 1,
    };

    const result = service.resolveConflict(local, remote);
    expect(result.winner).toBe(local);
    expect(result.strategy).toBe('vector-clock');
  });

  it('should resolve when remote is newer', () => {
    const local: RecordData = {
      id: 'record-1',
      value: { name: 'Alice' },
      timestamp: Date.now(),
      region: 'us-east',
      vectorClock: { 'us-east': 1 },
      version: 1,
    };

    const remote: RecordData = {
      id: 'record-1',
      value: { name: 'Bob' },
      timestamp: Date.now(),
      region: 'us-west',
      vectorClock: { 'us-west': 2 },
      version: 2,
    };

    const result = service.resolveConflict(local, remote);
    expect(result.winner).toBe(remote);
    expect(result.strategy).toBe('vector-clock');
  });

  it('BUG: Concurrent updates lose data with last-write-wins', () => {
    const local: RecordData = {
      id: 'record-1',
      value: { balance: 100 },
      timestamp: Date.now(),
      region: 'us-east',
      vectorClock: { 'us-east': 1 },
      version: 1,
    };

    const remote: RecordData = {
      id: 'record-1',
      value: { balance: 200 },
      timestamp: Date.now() + 1, // Slightly later
      region: 'us-west',
      vectorClock: { 'us-west': 1 },
      version: 1,
    };

    const result = service.resolveConflict(local, remote);

    // BUG: Last-write-wins picks remote because timestamp is later
    // But both updates are valid and should be merged
    expect(result.winner.value).toEqual({ balance: 200 });
    expect(result.strategy).toBe('last-write-wins');
    expect(result.loser.value).toEqual({ balance: 100 });

    // The loser's data is lost - this is the bug!
    expect(service.getConflictCount()).toBe(1);
  });

  it('should detect concurrent updates with vector clocks', () => {
    const local: RecordData = {
      id: 'record-1',
      value: { balance: 100 },
      timestamp: Date.now(),
      region: 'us-east',
      vectorClock: { 'us-east': 1 },
      version: 1,
    };

    const remote: RecordData = {
      id: 'record-1',
      value: { balance: 200 },
      timestamp: Date.now(),
      region: 'us-west',
      vectorClock: { 'us-west': 1 },
      version: 1,
    };

    const comparison = service.compareVectorClocks(local.vectorClock, remote.vectorClock);
    expect(comparison).toBe('concurrent');
  });

  it('should track conflicts', () => {
    const local: RecordData = {
      id: 'record-1',
      value: { balance: 100 },
      timestamp: Date.now(),
      region: 'us-east',
      vectorClock: { 'us-east': 1 },
      version: 1,
    };

    const remote: RecordData = {
      id: 'record-1',
      value: { balance: 200 },
      timestamp: Date.now() + 1,
      region: 'us-west',
      vectorClock: { 'us-west': 1 },
      version: 1,
    };

    service.resolveConflict(local, remote);
    expect(service.getConflictCount()).toBe(1);
    expect(service.getConflicts()[0].regions).toContain('us-east');
    expect(service.getConflicts()[0].regions).toContain('us-west');
  });
});