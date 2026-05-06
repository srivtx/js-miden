import { config } from '../config.js';

export interface Totals {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

export function calculateTotals(items: Array<{ quantity: number; price: number }>): Totals {
  const subtotal = items.reduce((sum, item) => {
    return sum + item.quantity * item.price;
  }, 0);

  const tax = parseFloat((subtotal * config.taxRate).toFixed(2));
  const shipping = config.shippingBase + items.length * config.shippingPerItem;
  const total = parseFloat((subtotal + tax + shipping).toFixed(2));

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax,
    shipping: parseFloat(shipping.toFixed(2)),
    total,
  };
}
