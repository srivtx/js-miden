import { describe, it, expect } from 'vitest';
import { calculateBaggageFee, getMaxBaggageWeight } from '../src/utils/baggage.utils.js';

describe('Baggage Utils', () => {
  it('should calculate zero fee within allowance', () => {
    expect(calculateBaggageFee('ECONOMY', 1)).toBe(0);
    expect(calculateBaggageFee('BUSINESS', 2)).toBe(0);
    expect(calculateBaggageFee('FIRST', 3)).toBe(0);
  });

  it('should calculate extra baggage fee', () => {
    expect(calculateBaggageFee('ECONOMY', 3)).toBe(100); // 2 extra bags
    expect(calculateBaggageFee('BUSINESS', 4)).toBe(100); // 2 extra bags
    expect(calculateBaggageFee('FIRST', 5)).toBe(100); // 2 extra bags
  });

  it('should return correct max weight per class', () => {
    expect(getMaxBaggageWeight('ECONOMY')).toBe(23);
    expect(getMaxBaggageWeight('BUSINESS')).toBe(28);
    expect(getMaxBaggageWeight('FIRST')).toBe(32);
  });
});
