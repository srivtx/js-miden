import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { auctions, bids } from '../db.js';
import type { Auction, Bid } from '../types.js';

const router = Router();

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, startingPrice, endsAt } = req.body;
  const id = crypto.randomUUID();
  const auction: Auction = {
    id,
    title,
    description,
    startingPrice,
    currentPrice: startingPrice,
    highestBidderId: null,
    status: 'active',
    endsAt: new Date(endsAt),
    createdAt: new Date(),
  };
  auctions.set(id, auction);
  bids.set(id, []);
  res.status(201).json(auction);
});

router.get('/:id', (req, res) => {
  const auction = auctions.get(req.params.id);
  if (!auction) {
    res.status(404).json({ error: 'Auction not found' });
    return;
  }
  const auctionBids = bids.get(req.params.id) || [];
  res.json({ auction, bids: auctionBids });
});

router.post('/:id/bids', authMiddleware, (req: AuthRequest, res) => {
  const auctionId = req.params.id;
  const bidderId = req.userId!;
  const { amount } = req.body;
  
  const auction = auctions.get(auctionId);
  if (!auction) {
    res.status(404).json({ error: 'Auction not found' });
    return;
  }
  
  if (auction.status === 'closed') {
    res.status(400).json({ error: 'Auction is closed' });
    return;
  }
  
  // BUG: Race condition - read then write is not atomic
  // BUG: No validation that amount > currentPrice
  const currentPrice = auction.currentPrice;
  
  // Simulate some processing time to make race condition more likely
  const bid: Bid = {
    id: crypto.randomUUID(),
    auctionId,
    bidderId,
    amount,
    createdAt: new Date(),
  };
  
  const auctionBids = bids.get(auctionId) || [];
  auctionBids.push(bid);
  bids.set(auctionId, auctionBids);
  
  // BUG: This update can overwrite a higher bid that came in between read and write
  auction.currentPrice = amount;
  auction.highestBidderId = bidderId;
  
  // Auto-extend if bid in last 30 seconds
  const now = new Date();
  const timeRemaining = auction.endsAt.getTime() - now.getTime();
  if (timeRemaining < 30000 && timeRemaining > 0) {
    auction.endsAt = new Date(auction.endsAt.getTime() + 30000);
    auction.status = 'extended';
  }
  
  res.status(201).json(bid);
});

export { router as auctionsRouter };
