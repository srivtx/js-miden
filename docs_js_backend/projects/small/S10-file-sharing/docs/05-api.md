# S10 File Sharing — API Reference

## Files

### Upload File
`POST /upload`

**Request Body**
```json
{
  "filename": "report.pdf",
  "file": "JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2Jq..."
}
```

**Response 201**
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2024-01-02T12:00:00.000Z"
}
```

**Note**: File content must be base64-encoded. Maximum practical size is limited by JSON parser memory (~1–5 MB depending on Node.js settings).

### Download File
`GET /download/:token`

**Response 200**: Raw file bytes with headers:
```http
Content-Disposition: attachment; filename="report.pdf"
Content-Type: application/octet-stream
```

**Known Issue**: The endpoint does **not** check token expiration. Even after `expires_at` passes, the link remains active indefinitely.

### Get File Info
`GET /info/:token`

**Response 200**
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "original_name": "report.pdf",
  "expires_at": 1704202800000,
  "download_count": 3
}
```

## Error Scenarios

| Scenario | Status | Notes |
|----------|--------|-------|
| Missing file field | 400 | `{"error":"Missing file base64"}` |
| Missing filename | 400 | `{"error":"Missing filename"}` |
| Invalid token | 404 | `{"error":"Not found"}` |
| Expired token | 200 (bug) | Should be 410 Gone |
| Path traversal filename | 201 (bug) | Should sanitize or reject |
