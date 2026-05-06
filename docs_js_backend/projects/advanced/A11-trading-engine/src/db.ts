import type { Order, Trade } from './types.js';

// In-memory storage for Phase 1
const orders = new Map<string, Order>();
const trades = new Map<string, Trade>();

export function resetDb() {
  orders.clear();
  trades.clear();
}

export function getOrders() {
  return orders;
}

export function getTrades() {
  return trades;
}

export function createOrder(order: Order): Order {
  orders.set(order.id, order);
  return order;
}

export function updateOrder(order: Order): Order {
  orders.set(order.id, order);
  return order;
}

export function createTrade(trade: Trade): Trade {
  trades.set(trade.id, trade);
  return trade;
}

export function getOrderById(id: string): Order | undefined {
  return orders.get(id);
}

export function getOrdersBySymbol(symbol: string): Order[] {
  return Array.from(orders.values()).filter(o => o.symbol === symbol);
}

export function getTradesBySymbol(symbol: string): Trade[] {
  return Array.from(trades.values()).filter(t => t.symbol === symbol);
}
