import { Cart, CartItem } from './types.js';

const cartStore: Map<string, Cart> = new Map();

// BUG: Session fixation — cart ID is predictable (sequential counter).
// Attackers can guess cart IDs and access others' carts.
let cartCounter = 0;

function generateCartId(): string {
  cartCounter++;
  return `cart-${cartCounter}`;
}

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export async function getCart(cartId: string): Promise<Cart | undefined> {
  return cartStore.get(cartId);
}

export async function addToCart(data: { cartId?: string; productId: string; productName: string; quantity: number; price: number }): Promise<Cart> {
  let cartId = data.cartId;

  if (!cartId) {
    cartId = generateCartId();
  }

  let cart = cartStore.get(cartId);
  if (!cart) {
    cart = {
      id: cartId,
      items: [],
      total: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    cartStore.set(cartId, cart);
  }

  const existingItem = cart.items.find(item => item.productId === data.productId);
  if (existingItem) {
    existingItem.quantity += data.quantity;
  } else {
    cart.items.push({
      productId: data.productId,
      productName: data.productName,
      quantity: data.quantity,
      price: data.price,
    });
  }

  cart.total = calculateTotal(cart.items);
  cart.updatedAt = new Date();

  return cart;
}

export async function removeFromCart(cartId: string, productId: string): Promise<Cart | undefined> {
  const cart = cartStore.get(cartId);
  if (!cart) return undefined;

  const index = cart.items.findIndex(item => item.productId === productId);
  if (index === -1) return undefined;

  cart.items.splice(index, 1);
  cart.total = calculateTotal(cart.items);
  cart.updatedAt = new Date();

  return cart;
}

export async function mergeCartOnLogin(guestCartId: string, userCartId: string): Promise<Cart | undefined> {
  const guestCart = cartStore.get(guestCartId);
  const userCart = cartStore.get(userCartId);

  if (!guestCart) return userCart;
  if (!userCart) return guestCart;

  for (const guestItem of guestCart.items) {
    const existingItem = userCart.items.find(item => item.productId === guestItem.productId);
    if (existingItem) {
      existingItem.quantity += guestItem.quantity;
    } else {
      userCart.items.push(guestItem);
    }
  }

  userCart.total = calculateTotal(userCart.items);
  userCart.updatedAt = new Date();

  // Remove guest cart after merge
  cartStore.delete(guestCartId);

  return userCart;
}

// BUG: No expiry — carts accumulate forever in memory.
// In production with Redis, this would fill up storage.
export async function cleanupExpiredCarts(): Promise<number> {
  // Should delete carts older than X hours/days.
  // Currently does nothing.
  return 0;
}
