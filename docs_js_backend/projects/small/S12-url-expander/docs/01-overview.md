# S12 URL Expander — Overview

## Project Goal
Build an API that accepts a short URL, manually follows HTTP redirects, and returns the final destination URL along with the complete redirect chain. The project demonstrates redirect loop detection, SSRF prevention, HEAD vs GET semantics, and timeout handling.

## Key Features
- **Expand URL**: `POST /expand` follows redirects and returns the chain.
- **Loop detection**: Aborts if a redirect cycle is detected.
- **Redirect limit**: Max 10 hops to prevent infinite loops.
- **Timeout**: 5-second per-hop timeout.
- **HEAD fallback**: Uses HEAD first, falls back to GET on 405.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express
- **HTTP Client**: Built-in `http`/`https` modules (manual redirect following)
- **Language**: TypeScript

## High-Level Architecture

```
Client → POST /expand {url}
            ↓
      Validator (initial URL check)
            ↓
      Follower (manual http/https requests)
            ↓
      Response {final_url, chain, status}
```

## Entry Points
- `src/index.ts` — Server bootstrap.
- `src/app.ts` — Express app setup.
- `src/expander.ts` — Route handler for POST /expand.
- `src/follower.ts` — Manual redirect following logic.
- `src/validator.ts` — URL validation (initial request only).
- `tests/expander.test.ts` — Test suite with local mock servers.

## Scope & Limitations
This project intentionally contains an **SSRF vulnerability**: the initial URL is validated, but redirect targets are not. An attacker can pass an external URL that redirects to `http://localhost/` or internal IPs, bypassing the validator.
