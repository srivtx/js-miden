# Architecture

## Overview

The Trading Engine is a high-frequency order matching system built around price-time priority FIFO matching. It handles limit orders, market orders, and maintains real-time order books for multiple symbols.

## Services

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Order     │────▶│  PostgreSQL  │
│   (Trader)  │◀────│   Service   │◀────│  (Orders,   │
└─────────────┘     └──────┬──────┘     │   Trades)    │
                           │            └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Matching  │
                    │   Engine    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Trade     │
                    │   Service   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Market Data│
                    │   Service   │
                    └─────────────┘
```

## Order Book Structure

### Buy Side (Bids)
- Sorted by price descending, then time ascending
- Highest bid at top

### Sell Side (Asks)
- Sorted by price ascending, then time ascending
- Lowest ask at top

## Matching Algorithm

1. Receive incoming order
2. Determine opposite side of book
3. Iterate through resting orders in priority order
4. Check price compatibility
5. Calculate fill quantity = min(remaining, available)
6. Create trade record
7. Update both orders
8. Repeat until order filled or no more matches

## Price-Time Priority

Given two orders at the same price, the earlier order gets filled first. This prevents queue-jumping and ensures fairness.

## Concurrency Model

### Problem
Multiple traders may submit orders simultaneously that match against the same resting order.

### Current (Buggy) Implementation
The matching engine reads the resting order quantity, computes fill, writes back. Without atomic locking, concurrent matches can over-fill or under-fill.

### Correct Implementation
Use database advisory locks or atomic compare-and-swap:
```sql
UPDATE orders 
SET filled_quantity = filled_quantity + ?
WHERE id = ? AND filled_quantity + ? <= quantity;
```
