# A04 Payment Orchestrator - API Reference

## Payment Endpoints

### POST /payments
Create a new payment. Idempotent - duplicate requests with same `idempotencyKey` return the original payment.

**Request Body:**
```json
{
  "amount": 100,
  "currency": "USD",
  "description": "Payment for order #123",
  "customerEmail": "customer@example.com",
  "idempotencyKey": "optional-unique-key",
  "metadata": {
    "orderId": "123"
  }
}
```

**Validation Rules:**
- `amount`: required, positive number, max 1,000,000
- `currency`: required, 3-letter ISO code
- `description`: required, 1-500 characters
- `customerEmail`: required, valid email
- `idempotencyKey`: optional, 1-255 characters
- `metadata`: optional, key-value string pairs

**Response (201 Created):**
```json
{
  "id": "uuid",
  "amount": 100,
  "currency": "USD",
  "description": "Payment for order #123",
  "status": "succeeded",
  "provider": "stripe",
  "providerTransactionId": "stripe_1234567890_abc",
  "idempotencyKey": "optional-unique-key",
  "customerEmail": "customer@example.com",
  "metadata": {
    "orderId": "123"
  },
  "attempts": [
    {
      "provider": "stripe",
      "status": "success",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "reconciledAt": null
}
```

**Response (200 OK - idempotent duplicate):**
Same as above but status code 200.

### GET /payments/:id
Retrieve a specific payment.

### GET /payments/status/:status
List payments by status.

**URL Parameters:**
| Parameter | Description                                      |
|-----------|--------------------------------------------------|
| status    | pending, processing, succeeded, failed, refunded |

### POST /payments/:id/refund
Refund a succeeded payment.

**Response:**
```json
{
  "id": "uuid",
  "status": "refunded",
  ...
}
```

### GET /providers/status
Get circuit breaker status for all providers.

**Response:**
```json
{
  "providers": [
    {
      "provider": "stripe",
      "state": "closed",
      "failureCount": 0,
      "successCount": 0
    },
    {
      "provider": "paypal",
      "state": "closed",
      "failureCount": 0,
      "successCount": 0
    }
  ]
}
```

## Webhook Endpoints

### POST /webhooks/stripe
Handle Stripe webhooks.

**Headers:**
- `stripe-signature`: Webhook signature for verification

**Request Body:**
```json
{
  "provider": "stripe",
  "eventType": "payment_intent.succeeded",
  "transactionId": "stripe_1234567890_abc",
  "status": "succeeded",
  "metadata": {}
}
```

### POST /webhooks/paypal
Handle PayPal webhooks.

**Headers:**
- `paypal-signature`: Webhook signature for verification

**Request Body:**
```json
{
  "provider": "paypal",
  "eventType": "PAYMENT.CAPTURE.COMPLETED",
  "transactionId": "paypal_1234567890_abc",
  "status": "succeeded",
  "metadata": {}
}
```

## Reconciliation Endpoints

### POST /reconcile
Run reconciliation for a specific date.

**Query Parameters:**
| Parameter | Type   | Default | Description       |
|-----------|--------|---------|-------------------|
| date      | string | today   | ISO date (YYYY-MM-DD) |

**Response:**
```json
{
  "date": "2024-01-01",
  "totalPayments": 150,
  "matched": 148,
  "unmatched": 2,
  "discrepancies": [
    {
      "paymentId": "uuid",
      "expectedStatus": "succeeded",
      "actualStatus": "failed",
      "provider": "stripe"
    }
  ]
}
```

## Error Responses

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
```

**Status Codes:**
- `400` - Bad Request (validation error)
- `404` - Not Found (payment or transaction)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
