import { describe, it, expect } from 'vitest';
import { calculateRefund, calculatePriceWithTiers } from '../src/utils/pricing.utils.js';

describe('Pricing Utils', () => {
  it('should calculate full refund for flexible policy', () => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 5);
    const refund = calculateRefund(200, 'FLEXIBLE', checkIn);
    expect(refund).toBe(200);
  });

  it('should calculate half refund for standard policy', () => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 2);
    const refund = calculateRefund(200, 'STANDARD', checkIn);
    expect(refund).toBe(100);
  });

  it('should calculate zero refund for strict policy close to check-in', () => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const refund = calculateRefund(200, 'STRICT', checkIn);
    expect(refund).toBe(0);
  });

  it('should apply pricing tiers correctly', () => {
    const basePrice = 100;
    const checkIn = new Date('2024-06-01');
    const checkOut = new Date('2024-06-04');
    const tiers = [
      { startDate: new Date('2024-06-01'), endDate: new Date('2024-06-02'), multiplier: 1.5 },
      { startDate: new Date('2024-06-03'), endDate: new Date('2024-06-04'), multiplier: 1.2 },
    ];

    const price = calculatePriceWithTiers(basePrice, checkIn, checkOut, tiers);
    expect(price).toBe(100 * 1.5 + 100 * 1.2 + 100); // 3 nights
  });
});
