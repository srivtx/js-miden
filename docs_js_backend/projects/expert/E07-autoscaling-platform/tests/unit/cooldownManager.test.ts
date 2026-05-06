import { describe, it, expect, beforeEach } from 'vitest';
import { isCooldownElapsed, recordScaling, clearState } from '../../src/services/cooldownManager.js';

beforeEach(() => clearState());

describe('cooldownManager', () => {
  it('allows action when no previous scaling', () => {
    expect(isCooldownElapsed('wl-1', 60000)).toBe(true);
  });

  it('blocks action within cooldown', () => {
    recordScaling('wl-1', 'scale_up');
    expect(isCooldownElapsed('wl-1', 60000)).toBe(false);
  });
});
