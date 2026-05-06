import { describe, it, expect } from 'vitest';
import { calculatePayment, calculateDepreciation } from '../src/utils/payment.utils.js';

describe('Payment Utils', () => {
  it('should apply deductible correctly', () => {
    expect(calculatePayment(3000, 500, 50000)).toBe(2500);
  });

  it('should apply coverage limit', () => {
    expect(calculatePayment(60000, 500, 50000)).toBe(50000);
  });

  it('should handle amount less than deductible', () => {
    expect(calculatePayment(400, 500, 50000)).toBe(0);
  });

  it('should calculate depreciation', () => {
    expect(calculateDepreciation(10000, 1, 0.1)).toBe(9000);
    expect(calculateDepreciation(10000, 5, 0.1)).toBeCloseTo(5904.90, 0);
  });
});
