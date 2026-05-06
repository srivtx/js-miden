import type { Auction, Bid } from '../types.js';

// In-memory store for testing/demo
export const auctions = new Map<string, Auction>();
export const bids = new Map<string, Bid[]>();

export function resetDb() {
  auctions.clear();
  bids.clear();
}
