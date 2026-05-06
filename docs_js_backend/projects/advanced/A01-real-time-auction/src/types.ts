export interface Auction {
  id: string;
  title: string;
  description: string;
  startingPrice: number;
  currentPrice: number;
  highestBidderId: string | null;
  status: 'created' | 'active' | 'extended' | 'closed';
  endsAt: Date;
  createdAt: Date;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  createdAt: Date;
}

export interface BidInput {
  amount: number;
}

export interface AuctionState {
  auction: Auction;
  bids: Bid[];
}
