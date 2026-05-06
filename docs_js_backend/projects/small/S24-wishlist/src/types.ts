export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  price: number;
  addedAt: Date;
}

export interface PriceChange {
  productId: string;
  oldPrice: number;
  newPrice: number;
  changedAt: Date;
}

export interface AddItemRequest {
  userId: string;
  productId: string;
  productName: string;
  price: number;
}
