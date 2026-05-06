import type { OrderBook, OrderBookEntry } from '../types.js';
import { getOrdersBySymbol } from '../db.js';

export function getOrderBook(symbol: string): OrderBook {
  const orders = getOrdersBySymbol(symbol).filter(o => o.status === 'open' || o.status === 'partially_filled');

  const bids = aggregateSide(orders.filter(o => o.side === 'buy'));
  const asks = aggregateSide(orders.filter(o => o.side === 'sell'));

  return {
    symbol,
    bids: bids.sort((a, b) => b.price - a.price),
    asks: asks.sort((a, b) => a.price - b.price),
    lastTradePrice: null,
  };
}

function aggregateSide(orders: import('../types.js').Order[]): OrderBookEntry[] {
  const map = new Map<number, { quantity: number; count: number }>();
  for (const o of orders) {
    const remaining = o.quantity - o.filledQuantity;
    if (remaining <= 0) continue;
    const existing = map.get(o.price) || { quantity: 0, count: 0 };
    existing.quantity += remaining;
    existing.count += 1;
    map.set(o.price, existing);
  }
  return Array.from(map.entries()).map(([price, data]) => ({
    price,
    quantity: data.quantity,
    orderCount: data.count,
  }));
}
