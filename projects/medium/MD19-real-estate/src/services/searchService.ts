import { prisma } from '../utils/prisma.js';

interface SearchFilters {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  propertyType?: string;
}

export class SearchService {
  async search(filters: SearchFilters) {
    const where: any = { status: 'ACTIVE' };

    // BUG: Using LIKE on address - slow on millions of listings
    // No full-text search index or trigram index
    if (filters.location) {
      where.OR = [
        { address: { contains: filters.location, mode: 'insensitive' } },
        { city: { contains: filters.location, mode: 'insensitive' } },
        { state: { contains: filters.location, mode: 'insensitive' } },
        { zipCode: { contains: filters.location, mode: 'insensitive' } },
      ];
    }

    if (filters.minPrice !== undefined) {
      where.price = { ...where.price, gte: filters.minPrice };
    }

    if (filters.maxPrice !== undefined) {
      where.price = { ...where.price, lte: filters.maxPrice };
    }

    if (filters.beds !== undefined) {
      where.beds = { gte: filters.beds };
    }

    if (filters.baths !== undefined) {
      where.baths = { gte: filters.baths };
    }

    if (filters.propertyType) {
      where.propertyType = filters.propertyType;
    }

    // This query will be very slow with millions of listings
    // because ILIKE on address cannot use a standard B-tree index
    return prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // BUG: No geospatial indexing - can't search "within 5 miles" efficiently
  async searchNearby(lat: number, lng: number, radiusMiles: number) {
    const radiusKm = radiusMiles * 1.60934;

    // BUG: Fetching all listings and filtering in application code
    // This is extremely inefficient for large datasets
    const allListings = await prisma.listing.findMany({
      where: { status: 'ACTIVE' },
    });

    // Filter by distance in application code (very slow!)
    const nearby = allListings.filter((listing) => {
      const distance = this.calculateDistance(
        lat,
        lng,
        listing.latitude,
        listing.longitude
      );
      return distance <= radiusKm;
    });

    // Sort by distance
    nearby.sort((a, b) => {
      const distA = this.calculateDistance(lat, lng, a.latitude, a.longitude);
      const distB = this.calculateDistance(lat, lng, b.latitude, b.longitude);
      return distA - distB;
    });

    return nearby.slice(0, 50);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
