# Thinking Process

## Mental Models

### The CORS Handshake

Every CORS request is either **simple** or **preflighted**. Understanding which path a request takes is essential.

```
┌─────────────┐
│  Browser    │
│  wants to   │
│  send POST  │
│  with JSON  │
└──────┬──────┘
       │
       ▼
┌──────────────┐    Yes     ┌─────────────────┐
│ Is it simple?│───────────▶│ Send directly   │
│ (GET/POST,   │            │ with Origin hdr │
│  no custom   │            └────────┬────────┘
│  headers,    │                     │
│  no creds)   │    No              ▼
└──────┬───────┘           ┌────────────────────┐
       │                   │ Server checks      │
       │                   │ Access-Control-*   │
       │                   │ headers            │
       │                   └────────┬───────────┘
       │                            │
       │                    ┌───────┴────────┐
       │                    │ Allow? Reflect │
       │                    │ origin, send   │
       │                    │ credentials    │
       │                    └───────┬────────┘
       │                            │
       ▼                            ▼
┌──────────────┐         ┌─────────────────────┐
│ Send actual  │         │ Browser blocks with │
│ request with │         │ CORS error in       │
│ credentials  │         │ console             │
└──────────────┘         └─────────────────────┘
```

### Simple vs Preflighted Requests

A request is **simple** only if ALL of these are true:
- Method is GET, HEAD, or POST
- Headers are only CORS-safelisted (no `Authorization`, no `Content-Type: application/json`)
- No credentials (cookies, auth headers)

Because our API uses `Authorization` and `application/json`, **every request is preflighted**.

```
Simple request path:
Browser ──► Server
   │           │
   │◄──────────┘  (single round-trip)

Preflighted request path:
Browser ──OPTIONS──► Server  ("May I?")
   │◄────────────────┘  "Yes, for 10 minutes"
   │
   ├───POST /data──► Server  ("Here is my real request")
   │◄────────────────┘  "200 OK with data"
```

## The Hot Path

What happens most often: a browser makes a preflight `OPTIONS` request, then the real request. The server must:
1. Answer `OPTIONS` quickly with correct `Access-Control-Allow-*` headers.
2. On the real request, reflect the exact `Origin` (NOT `*`) when credentials are involved.

## The Danger Zone

Three catastrophic misconfigurations:

1. **`Access-Control-Allow-Origin: *` + `Access-Control-Allow-Credentials: true`**
   - Browsers reject it, but the server still advertises "anyone can have authenticated data."
   - This is an information leak and a sign of security negligence.

2. **Reflecting any origin without an allowlist**
   - `cors({ origin: true })` mirrors back whatever `Origin` header the browser sends.
   - An attacker on `evil.com` can now make credentialed requests and read responses.

3. **Missing `Vary: Origin` on cached responses**
   - A CDN caches a response with `Access-Control-Allow-Origin: https://app.example.com`.
   - `https://evil.com` hits the same URL. CDN serves the cached response.
   - Browser sees wrong origin, blocks the response, but the real damage is data cross-contamination.

## Question Everything

- **Do we need a database?** No. CORS is purely an HTTP header negotiation.
- **Do we need Redis?** No. CORS state lives in the browser, not the server.
- **Do we need auth?** We simulate auth (`Authorization` header) to test the credentials path.
- **Do we need real-time?** No. CORS is request/response, not persistent.

## The "What If" Game

- **What if 1000 users hit this at once?** CORS middleware is stateless and O(1). It scales linearly with Express.
- **What if the database is down?** No database; irrelevant.
- **What if a user sends garbage?** The `cors` middleware ignores malformed headers safely.
- **What if two users do the same thing?** Each request carries its own `Origin` header. There is no shared state.
