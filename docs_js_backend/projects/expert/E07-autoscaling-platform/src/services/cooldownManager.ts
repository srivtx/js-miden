import type { ScalingState } from '../types/index.js';
import { now } from '../utils/time.js';

const state = new Map<string, ScalingState>();

export function getState(workloadId: string): ScalingState {
  return state.get(workloadId) ?? { lastScaleTime: 0, lastAction: 'none' };
}

export function recordScaling(workloadId: string, action: 'scale_up' | 'scale_down'): void {
  state.set(workloadId, { lastScaleTime: now(), lastAction: action });
}

export function isCooldownElapsed(workloadId: string, cooldownMs: number): boolean {
  const s = getState(workloadId);
  return now() - s.lastScaleTime >= cooldownMs;
}

export function clearState(): void {
  state.clear();
}
