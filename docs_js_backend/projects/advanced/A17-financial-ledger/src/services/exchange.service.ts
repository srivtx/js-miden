import { logger } from '../utils/logger.js';

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

const rates = new Map<string, ExchangeRate>();

export class ExchangeService {
  async setRate(from: string, to: string, rate: number): Promise<ExchangeRate> {
    const key = `${from}:${to}`;
    const exchangeRate: ExchangeRate = { from, to, rate, timestamp: new Date() };
    rates.set(key, exchangeRate);
    logger.info({ from, to, rate }, 'Exchange rate set');
    return exchangeRate;
  }

  async getRate(from: string, to: string): Promise<ExchangeRate | null> {
    if (from === to) {
      return { from, to, rate: 1, timestamp: new Date() };
    }
    return rates.get(`${from}:${to}`) || null;
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    const rate = await this.getRate(from, to);
    if (!rate) {
      throw new Error(`No exchange rate found for ${from} -> ${to}`);
    }
    // BUG: Floating-point multiplication.
    return amount * rate.rate;
  }
}

export const exchangeService = new ExchangeService();
