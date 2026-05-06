# S12 URL Expander — API Reference

## Expand

### Expand URL
`POST /expand`

**Request Body**
```json
{
  "url": "https://t.co/shortlink"
}
```

**Response 200**
```json
{
  "final_url": "https://example.com/very/long/path",
  "chain": [
    "https://t.co/shortlink",
    "https://bit.ly/abc",
    "https://example.com/very/long/path"
  ],
  "status": "success"
}
```

**Response 400 (Loop)**
```json
{
  "error": "Redirect loop detected"
}
```

**Response 400 (Too many redirects)**
```json
{
  "error": "Too many redirects"
}
```

**Known Issue**: The endpoint validates the initial URL but does not validate redirect targets. An attacker can use an external redirector to reach internal IPs (SSRF).

## Error Scenarios

| Scenario | Status | Notes |
|----------|--------|-------|
| Missing url | 400 | `{"error":"Missing url"}` |
| Invalid initial URL | 400 | Blocked by validator |
| Redirect loop | 400 | Detected by chain duplication |
| Too many redirects | 400 | Max 10 hops exceeded |
| Request timeout | 400 | Per-hop 5s timeout |
| SSRF via redirect | 200 (bug) | Should be blocked |
