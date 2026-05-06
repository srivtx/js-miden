export interface CreateShipmentInput {
  originId: string;
  destinationId: string;
  weight: number;
  createdBy: string;
}

export interface UpdateStatusInput {
  status: string;
}

export interface TrackingEventInput {
  status: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface CreateWarehouseInput {
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  capacity?: number;
}

export interface UpdateInventoryInput {
  sku: string;
  quantity: number;
}
