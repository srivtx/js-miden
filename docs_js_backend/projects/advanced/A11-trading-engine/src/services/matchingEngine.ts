import type { Order, Trade, OrderSide } from '../types.js';
import { getOrdersBySymbol, createTrade, updateOrder, getOrderById } from '../db.js';

// BUG: Race condition in matching.
// When two orders match the same counterparty concurrently,
// there is no lock on the resting order. Both matchers read
// the old available quantity, create trades, and write back.
// This can over-fill a resting order or leave one incoming
// order unfilled when it should have been filled.

function sortByPriceTime(a: Order, b: Order, side: OrderSide): number {
  if (side === 'buy') {
    // Higher price first, then earlier time
    if (b.price !== a.price) return b.price - a.price;
    return a.createdAt.getTime() - b.createdAt.getTime();
  } else {
    // Lower price first, then earlier time
    if (a.price !== b.price) return a.price - b.price;
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
}

export async function matchOrder(incomingOrder: Order): Promise<Trade[]> {
  const trades: Trade[] = [];
  let remaining = incomingOrder.quantity - incomingOrder.filledQuantity;

  const oppositeSide: OrderSide = incomingOrder.side === 'buy' ? 'sell' : 'buy';
  const candidates = getOrdersBySymbol(incomingOrder.symbol)
    .filter(o => o.side === oppositeSide && o.status !== 'filled' && o.status !== 'cancelled');

  candidates.sort((a, b) => sortByPriceTime(a, b, oppositeSide));

  for (const resting of candidates) {
    if (remaining <= 0) break;

    // Price validation
    if (incomingOrder.side === 'buy' && incomingOrder.type === 'limit' && incomingOrder.price < resting.price) {
      continue;
    }
    if (incomingOrder.side === 'sell' && incomingOrder.type === 'limit' && incomingOrder.price > resting.price) {
      continue;
    }

    const available = resting.quantity - resting.filledQuantity;
    const fillQty = Math.min(remaining, available);

    if (fillQty <= 0) continue;

    // Simulate async DB/network latency to exacerbate race condition
    await new Promise(r => setTimeout(r, 50));

    // BUG: Uses original resting object without re-reading current state.
    // Under concurrency, another match may have already updated this order,
    // but we overwrite it with stale data, causing over-fill.
    const actualFill = fillQty;

    const trade: Trade = {
      id: crypto.randomUUID(),
      buyOrderId: incomingOrder.side === 'buy' ? incomingOrder.id : resting.id,
      sellOrderId: incomingOrder.side === 'sell' ? incomingOrder.id : resting.id,
      symbol: incomingOrder.symbol,
      price: resting.price,
      quantity: actualFill,
      createdAt: new Date(),
    };

    createTrade(trade);
    trades.push(trade);

    // Update incoming order
    incomingOrder.filledQuantity += actualFill;
    if (incomingOrder.filledQuantity >= incomingOrder.quantity) {
      incomingOrder.status = 'filled';
    } else {
      incomingOrder.status = 'partially_filled';
    }

    // BUG: Update resting order without atomic check
    // Another concurrent match may have already updated filledQuantity,
    // but this write overwrites it, causing total filled > quantity.
    resting.filledQuantity += actualFill;
    if (resting.filledQuantity >= resting.quantity) {
      resting.status = 'filled';
    } else {
      resting.status = 'partially_filled';
    }
    updateOrder(resting);

    remaining -= actualFill;
  }

  return trades;
}
