# 00-PROBLEM.md

## The Core Problem

How do you build a wishlist service where users can save items, view only their own list, and avoid duplicates—without leaking data between users?

## Real-World Context

E-commerce platforms (Amazon, ASOS, Etsy) and content platforms (Steam, Netflix) all use wishlists/favorites to drive conversion and engagement. A broken wishlist leaks user preferences, creates duplicate entries, and erodes trust.

## Specific Pain Points

1. **No user isolation**: One user's wishlist is visible to all users (privacy breach)
2. **No deduplication**: Same item added multiple times, cluttering the UI
3. **No authorization**: Anyone can delete anyone else's items
4. **Data leakage**: Wishlist contents reveal shopping habits, price sensitivity, gift plans
5. **Storage waste**: Duplicate entries inflate database size and complicate analytics

## What This Project Demonstrates

A wishlist service that lets users add, view, and remove items—but fails to isolate data by user and fails to prevent duplicate items.

## ASCII: Broken vs Correct Flow

```
BROKEN (No Isolation)                    CORRECT (Isolated)
=====================                    ==================

User A adds Item X                         User A adds Item X
       |                                         |
       v                                         v
  [Shared Array]                          [User A's List]
       |                                         |
       v                                         v
User B views /wishlist/user-a            User B views /wishlist/user-b
       |                                         |
       v                                         v
  [Sees Item X]                          [Sees empty list]
       |                                         |
       v                                         v
User B adds Item X again                 User B tries to add Item X
       |                                         |
       v                                         v
  [Duplicate!]                           [409 Conflict — already exists]
```

## Domain

Multi-tenant data isolation, composite unique constraints, e-commerce user data, GDPR/privacy compliance.
