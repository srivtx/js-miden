# 03-api-reference.md

## GET /cart/:cartId

View cart contents and total.

**Response:**
```json
{
  "id": "cart-1",
  "items": [
    { "productId": "p1", "productName": "Widget", "quantity": 2, "price": 19.99 }
  ],
  "total": 39.98,
  "createdAt": "...",
  "updatedAt": "..."
}
```

## POST /cart/add

Add an item. Creates cart if no `cartId` provided.

**Body:**
```json
{
  "cartId": "cart-1",
  "productId": "p1",
  "productName": "Widget",
  "quantity": 2,
  "price": 19.99
}
```

## DELETE /cart/:cartId/item/:productId

Remove an item from cart.

## POST /cart/merge

Merge guest cart into user cart.

**Body:**
```json
{
  "guestCartId": "cart-1",
  "userCartId": "cart-2"
}
```
