import { describe, it } from 'node:test';
import assert from 'node:assert';
import { assignVariant, getStats } from '../src/store.js';

describe('A/B Testing', () => {
  // FAILING TEST: Non-deterministic assignment
  it('should assign the same variant for the same user consistently', () => {
    const userId = 'user-123';
    const experiment = 'button-color';
    
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(assignVariant(experiment, userId));
    }
    
    // All 50 assignments should be the same variant
    // Currently fails because Math.random() returns different variants
    assert.strictEqual(results.size, 1, `User got ${results.size} different variants: ${Array.from(results).join(', ')}`);
  });

  // FAILING TEST: No control group
  it('should have a control group for comparison', () => {
    const stats = getStats('button-color');
    
    // Stats should include a control group
    const variants = (stats?.variants as Array<{ name: string }>) || [];
    const hasControl = variants.some(v => v.name === 'control');
    
    assert.ok(hasControl, 'Experiment must have a control group to measure effect');
  });
});
