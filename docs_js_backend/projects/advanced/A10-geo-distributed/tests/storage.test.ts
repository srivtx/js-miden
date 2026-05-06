import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../src/services/StorageService.js';

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService('us-east');
  });

  it('should store and retrieve data', () => {
    storage.update('record-1', { name: 'Alice' });
    const record = storage.get('record-1');
    expect(record).not.toBeNull();
    expect(record?.value).toEqual({ name: 'Alice' });
  });

  it('should update vector clock on each write', () => {
    storage.update('record-1', { name: 'Alice' });
    const r1 = storage.get('record-1')!;
    expect(r1.vectorClock['us-east']).toBe(1);

    storage.update('record-1', { name: 'Bob' });
    const r2 = storage.get('record-1')!;
    expect(r2.vectorClock['us-east']).toBe(2);
  });

  it('should increment version on update', () => {
    storage.update('record-1', { name: 'Alice' });
    storage.update('record-1', { name: 'Bob' });
    const record = storage.get('record-1');
    expect(record?.version).toBe(2);
  });

  it('should return null for missing record', () => {
    expect(storage.get('missing')).toBeNull();
  });

  it('should delete records', () => {
    storage.update('record-1', { name: 'Alice' });
    expect(storage.delete('record-1')).toBe(true);
    expect(storage.get('record-1')).toBeNull();
  });
});