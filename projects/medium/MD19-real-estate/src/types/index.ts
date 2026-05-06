export interface CreateListingInput {
  title: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  latitude: number;
  longitude: number;
  propertyType: string;
  agentId?: string;
}

export interface SearchFilters {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  propertyType?: string;
}

export interface BookTourInput {
  listingId: string;
  userId: string;
  date: string;
  notes?: string;
}
