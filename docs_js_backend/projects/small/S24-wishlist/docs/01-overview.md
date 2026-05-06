# 01-overview.md

## WHAT

A wishlist/favorites service where users save items, view their lists, remove items, and receive mock price change notifications.

## WHY

E-commerce and content platforms use wishlists to increase conversion and engagement. Price tracking adds value by alerting users to deals.

## HOW

- `GET /wishlist/:userId` — list a user's wishlist
- `POST /wishlist` — add an item
- `DELETE /wishlist/:userId/:itemId` — remove an item
- `GET /wishlist/:userId/price-changes` — check for price changes
