import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CheckoutInput {
  cartId: string;
  idempotencyKey: string;
  shippingAddress: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}
