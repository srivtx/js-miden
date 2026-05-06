# S13 API Key Manager — API Reference

## Keys

### Generate Key
`POST /keys`

**Request Body**
```json
{
  "name": "Mobile App",
  "scopes": ["read:users", "write:posts"],
  "rate_limit": 1000,
  "expires_in_days": 90
}
```

**Response 201**
```json
{
  "key": "pk_live_a1b2c3d4e5f6...",
  "name": "Mobile App"
}
```

**Important**: The full key is shown exactly once. Store it securely.

**Known Issue**: The key is stored in plaintext in the database, not hashed.

### List Active Keys
`GET /keys`

**Response 200**
```json
{
  "keys": [
    {
      "id": 1,
      "prefix": "pk_live_",
      "name": "Mobile App",
      "scopes": "[\"read:users\",\"write:posts\"]",
      "rate_limit": 1000,
      "expires_at": null,
      "revoked": 0,
      "created_at": 1700000000000
    }
  ]
}
```

### Revoke Key
`DELETE /keys/:id`

**Response 200**
```json
{ "revoked": true }
```

## Protected Endpoint (Example)

### Access Protected Resource
`GET /protected`

**Headers**
```http
x-api-key: pk_live_...
```

**Response 200**
```json
{ "message": "Access granted" }
```

**Response 401**
```json
{ "error": "Invalid API key" }
```

**Response 429**
```json
{ "error": "Rate limit exceeded" }
```

## Error Scenarios

| Scenario | Status | Notes |
|----------|--------|-------|
| Missing x-api-key | 401 | On protected routes |
| Invalid key | 401 | Key not found or revoked |
| Expired key | 200 (bug) | Should be 401 |
| Rate limit exceeded | 429 | Per-minute window |
