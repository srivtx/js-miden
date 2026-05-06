export interface RestaurantInput {
  name: string;
  description?: string;
  address: string;
  latitude: number;
  longitude: number;
  cuisine: string;
  ownerId: string;
}

export interface MenuItemInput {
  name: string;
  description?: string;
  price: number;
  category: string;
  inventory: number;
}

export interface OrderItemInput {
  menuId: string;
  quantity: number;
}

export interface OrderInput {
  customerId: string;
  restaurantId: string;
  items: OrderItemInput[];
  address: string;
  latitude: number;
  longitude: number;
}

export interface DriverInput {
  userId: string;
}

export interface LocationInput {
  latitude: number;
  longitude: number;
}
