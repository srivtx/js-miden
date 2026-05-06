import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictResolutionService } from '../src/services/ConflictResolutionService.js';
import { CRDTDocument } from '../src/types/index.js';

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService;

  beforeEach(() => {
    service = new ConflictResolutionService();
  });

  it('should prefer local when local clock is newer', () => {
    const local: CRDTDocument = {
      id: 'doc-1',
      type: 'register',
      data: { value: 'local' },
      timestamp: Date.now(),
      vectorClock: { peer1: 2 },
    };

    const remote: CRDTDocument = {
      id: 'doc-1',
      type: 'register',
      data: { value: 'remote' },
      timestamp: Date.now(),
      vectorClock: { peer1: 1 },
    };

    const result = service.resolve(local, remote);
    expect(result.data).toEqual({ value: 'local' });
  });

  it('should prefer remote when remote clock is newer', () => {
    const local: CRDTDocument = {
      id: 'doc-1',
      type: 'register',
      data: { value: 'local' },
      timestamp: Date.now(),
      vectorClock: { peer1: 1 },
    };

    const remote: CRDTDocument = {
      id: 'doc-1',
      type: 'register',
      data: { value: 'remote' },
      timestamp: Date.now(),
      vectorClock: { peer1: 2 },
    };

    const result = service.resolve(local, remote);
    expect(result.data).toEqual({ value: 'remote' });
  });

  it('should merge concurrent updates', () => {
    const local: CRDTDocument = {
      id: 'doc-1',
      type: 'register',
      data: { value: 'local' },
      timestamp: Date.now(),
      vectorClock: { peer1: 1 },
    };

    const remote: CRDTDocument = {
      id: 'doc-1',
      type: 'register',
      data: { value: 'remote' },
      timestamp: Date.now() + 1,
      vectorClock: { peer2: 1 },
    };

    const result = service.resolve(local, remote);
    // LWW merge picks the later timestamp
    expect(result.data).toEqual({ value: 'remote' });
    expect(service.getMergeCount()).toBe(1);
  });

  it('should merge vector clocks correctly', () => {
    const local: CRDTDocument = {
      id: 'doc-1',
      type: 'register',
      data: { value: 'local' },
      timestamp: Date.now(),
      vectorClock: { peer1: 1, peer2: 2 },
    };

    const remote: CRDTDocument = {
      id: 'doc-1',
      type: 'register',
      data: { value: 'remote' },
      timestamp: Date.now(),
      vectorClock: { peer2: 1, peer3: 3 },
    };

    const result = service.resolve(local, remote);
    expect(result.vectorClock).toEqual({ peer1: 1, peer2: 2, peer3: 3 });
  });

  it('should detect concurrent updates', () => {
    const localClock = { peer1: 1 };
    const remoteClock = { peer2: 1 };

    const comparison = service.compareVectorClocks(localClock, remoteClock);
    expect(comparison).toBe('concurrent');
  });

  it('should throw for mismatched document IDs', () => {
    const local: CRDTDocument = {
      id: 'doc-1',
      type: 'register',
      data: {},
      timestamp: Date.now(),
      vectorClock: {},
    };

    const remote: CRDTDocument = {
      id: 'doc-2',
      type: 'register',
      data: {},
      timestamp: Date.now(),
      vectorClock: {},
    };

    expect(() => service.resolve(local, remote)).toThrow('different IDs');
  });
});