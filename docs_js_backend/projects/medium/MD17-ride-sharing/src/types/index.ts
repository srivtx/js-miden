export interface RequestRideInput {
  riderId: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
}

export interface AcceptRideInput {
  driverId: string;
}

export interface LocationUpdateInput {
  latitude: number;
  longitude: number;
}

export interface CreateReviewInput {
  rideId: string;
  reviewerId: string;
  rating: number;
  comment?: string;
}
