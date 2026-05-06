# 01-overview.md

## WHAT

A session-based shopping cart requiring no authentication. Users add/remove items, carts persist in memory (with Redis support in docker-compose), totals calculate automatically, and guest carts merge on login.

## WHY

Guest checkout reduces friction in e-commerce. Session-based carts let users shop immediately while still supporting account conversion later.

## HOW

- `GET /cart/:cartId` — view cart contents
- `POST /cart/add` — add item (creates cart if needed)
- `DELETE /cart/:cartId/item/:productId` — remove item
- `POST /cart/merge` — merge guest cart into user cart
