import { logger } from './logger.js';

/**
 * Money utility using native JavaScript numbers.
 * BUG: Floating-point precision errors (e.g., 0.1 + 0.2 !== 0.3).
 */
export class Money {
  constructor(public amount: number, public currency: string) {}

  add(other: Money): Money {
    // BUG: Uses floating-point arithmetic without precision handling.
    if (this.currency !== other.currency) {
      throw new Error('Currency mismatch');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Currency mismatch');
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  divide(divisor: number): Money {
    if (divisor === 0) throw new Error('Division by zero');
    return new Money(this.amount / divisor, this.currency);
  }

  equals(other: Money): boolean {
    // BUG: Direct comparison of floating-point numbers.
    return this.currency === other.currency && this.amount === other.amount;
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }

  toCents(): number {
    // BUG: Floating-point conversion to cents may be imprecise.
    return Math.round(this.amount * 100);
  }

  static fromCents(cents: number, currency: string): Money {
    return new Money(cents / 100, currency);
  }
}

export function convert(amount: number, fromRate: number, toRate: number): number {
  // BUG: Floating-point multiplication/division.
  return (amount * fromRate) / toRate;
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
