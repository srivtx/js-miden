export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddToCartRequest {
  cartId?: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}
