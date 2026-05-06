# 03-api-reference.md

## GET /wishlist/:userId

List items in a user's wishlist.

**Response:**
```json
[
  { "id": "abc", "productId": "p1", "productName": "Widget", "price": 29.99 }
]
```

## POST /wishlist

Add an item.

**Body:**
```json
{
  "userId": "user-1",
  "productId": "prod-1",
  "productName": "Blue Widget",
  "price": 29.99
}
```

## DELETE /wishlist/:userId/:itemId

Remove an item.

## GET /wishlist/:userId/price-changes

Check for price changes on wishlisted items.

**Response:**
```json
[
  { "productId": "p1", "oldPrice": 29.99, "newPrice": 24.99 }
]
```
