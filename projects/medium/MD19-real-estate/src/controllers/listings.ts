import { Request, Response } from 'express';
import { ListingService } from '../services/listingService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const listingService = new ListingService();

export const getListings = asyncHandler(async (_req: Request, res: Response) => {
  const listings = await listingService.getAllListings();
  res.json({ data: listings });
});

export const getListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await listingService.getListingById(req.params.id);
  res.json({ data: listing });
});

export const createListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await listingService.createListing(req.body);
  res.status(201).json({ data: listing });
});

export const updateListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await listingService.updateListing(req.params.id, req.body);
  res.json({ data: listing });
});
