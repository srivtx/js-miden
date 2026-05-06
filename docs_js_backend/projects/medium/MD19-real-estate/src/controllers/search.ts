import { Request, Response } from 'express';
import { SearchService } from '../services/searchService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const searchService = new SearchService();

export const searchListings = asyncHandler(async (req: Request, res: Response) => {
  const results = await searchService.search({
    location: req.query.location as string,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    beds: req.query.beds ? Number(req.query.beds) : undefined,
    baths: req.query.baths ? Number(req.query.baths) : undefined,
    propertyType: req.query.propertyType as string,
  });
  res.json({ data: results });
});

export const searchNearby = asyncHandler(async (req: Request, res: Response) => {
  const results = await searchService.searchNearby(
    Number(req.query.lat),
    Number(req.query.lng),
    Number(req.query.radius) || 5 // miles
  );
  res.json({ data: results });
});
