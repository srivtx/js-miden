import { prisma } from '../db.js';
import { CheckoutInput } from '../types.js';
import { calculateTotals } from '../utils/calculateTotals.js';
import { checkIdempotencyKey, storeIdempotencyKey } from '../utils/idempotency.js';
import { getOrCreateCart } from './cartService.js';

export async function createOrder(userId: string, input: CheckoutInput) {
  const existingOrderId = await checkIdempotencyKey(input.idempotencyKey);
  if (existingOrderId) {
    const existingOrder = await prisma.order.findUnique({ where: { id: existingOrderId } });
    if (existingOrder) return existingOrder;
  }

  const cart = await getOrCreateCart(userId);
  if (cart.items.length === 0) {
    throw Object.assign(new Error('Cart is empty'), { statusCode: 400, code: 'EMPTY_CART' });
  }

  // Validate inventory and calculate totals
  for (const item of cart.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) {
      throw Object.assign(new Error(`Product ${item.productId} not found`), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (product.stock < item.quantity) {
      throw Object.assign(
        new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`),
        { statusCode: 400, code: 'INSUFFICIENT_STOCK' }
      );
    }
  }

  const totals = calculateTotals(cart.items.map((item) => ({ quantity: item.quantity, price: Number(item.price) })));

  // BUG: Race condition in inventory decrement.
  // We read stock above, check it, then decrement here in separate queries.
  // Between the read and the write, another order could have decremented stock,
  // causing us to oversell (negative inventory) or fail silently.
  // FIX: Use a transaction with SELECT FOR UPDATE or atomic decrement.
  for (const item of cart.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
    });
  }

  const order = await prisma.order.create({
    data: {
      userId,
      status: 'CONFIRMED',
      idempotencyKey: input.idempotencyKey,
      subtotal: totals.subtotal,
      tax: totals.tax,
      shipping: totals.shipping,
      total: totals.total,
      items: {
        create: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });

  await prisma.cart.update({
    where: { id: cart.id },
    data: { status: 'CHECKED_OUT' },
  });

  await storeIdempotencyKey(input.idempotencyKey, order.id);

  return order;
}

export async function getOrdersByUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { product: true } } },
  });
}

export async function getOrderById(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: { include: { product: true } } },
  });
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404, code: 'NOT_FOUND' });
  return order;
}
