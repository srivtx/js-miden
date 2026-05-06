import { prisma } from '../db.js';
import { CartItemInput } from '../types.js';
import { calculateTotals } from '../utils/calculateTotals.js';
import { config } from '../config.js';

export async function getOrCreateCart(userId: string) {
  const existing = await prisma.cart.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: { items: { include: { product: true } } },
  });

  if (existing) return existing;

  return prisma.cart.create({
    data: {
      userId,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + config.cartExpirationHours * 60 * 60 * 1000),
    },
    include: { items: { include: { product: true } } },
  });
}

export async function addItemToCart(userId: string, input: CartItemInput) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404, code: 'NOT_FOUND' });
  if (product.stock < input.quantity) {
    throw Object.assign(new Error('Insufficient stock'), { statusCode: 400, code: 'INSUFFICIENT_STOCK' });
  }

  const cart = await getOrCreateCart(userId);

  const existingItem = cart.items.find((item) => item.productId === input.productId);

  if (existingItem) {
    const newQuantity = existingItem.quantity + input.quantity;
    if (product.stock < newQuantity) {
      throw Object.assign(new Error('Insufficient stock'), { statusCode: 400, code: 'INSUFFICIENT_STOCK' });
    }

    return prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
      include: { product: true },
    });
  }

  return prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: input.productId,
      quantity: input.quantity,
      price: product.price,
    },
    include: { product: true },
  });
}

export async function removeItemFromCart(userId: string, cartItemId: string) {
  const cart = await getOrCreateCart(userId);
  const item = cart.items.find((i) => i.id === cartItemId);
  if (!item) throw Object.assign(new Error('Item not found in cart'), { statusCode: 404, code: 'NOT_FOUND' });

  await prisma.cartItem.delete({ where: { id: cartItemId } });
  return { success: true };
}

export async function updateCartItemQuantity(userId: string, cartItemId: string, quantity: number) {
  if (quantity < 1) throw Object.assign(new Error('Quantity must be at least 1'), { statusCode: 400, code: 'INVALID_QUANTITY' });

  const cart = await getOrCreateCart(userId);
  const item = cart.items.find((i) => i.id === cartItemId);
  if (!item) throw Object.assign(new Error('Item not found in cart'), { statusCode: 404, code: 'NOT_FOUND' });

  if (item.product.stock < quantity) {
    throw Object.assign(new Error('Insufficient stock'), { statusCode: 400, code: 'INSUFFICIENT_STOCK' });
  }

  return prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
    include: { product: true },
  });
}

export async function getCartWithTotals(userId: string) {
  const cart = await getOrCreateCart(userId);
  const totals = calculateTotals(cart.items.map((item) => ({ quantity: item.quantity, price: Number(item.price) })));

  return {
    ...cart,
    totals,
  };
}

export async function clearCart(userId: string) {
  const cart = await getOrCreateCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return { success: true };
}
