# S12: URL Expander (Reverse URL Shortener)

## Overview
An API that accepts a short URL, follows HTTP redirects, and returns the final destination URL along with the full redirect chain. Demonstrates redirect loop detection, SSRF prevention, and timeout handling.

## Thinking Framework

### PHASE 1: Core Features
- `POST /expand` → accepts `{ "url": "..." }`, follows redirects, returns `{ "final_url", "chain", "status" }`.
- Detects redirect loops (circular chains).

### PHASE 2-3: Design Decisions
- **Redirect limits**: Max 10 redirects to prevent infinite loops.
- **Timeout handling**: 5-second timeout per hop to prevent hanging on slow servers.
- **Circular redirect detection**: Maintain a `Set` of visited URLs; if a redirect points to a previously visited URL, abort.
- **HEAD vs GET**: Use HEAD first (lighter), fall back to GET if server returns 405 Method Not Allowed.
- **SSRF Prevention**: Validate not just the initial URL, but every redirect target against private IP ranges and localhost.

### PHASE 4: Bugs & Hardening
- **SSRF via redirects**: The initial URL is validated, but redirect targets are not. An attacker can pass an external URL that redirects to `http://localhost:22/` or `http://169.254.169.254/latest/meta-data/iam/security-credentials/`, bypassing the allowlist.

## Project Structure
```
src/
  validator.ts - URL validation (initial request only)
  follower.ts  - Manual redirect following with http/https
  expander.ts  - Express router for POST /expand
  app.ts       - Express composition
  index.ts     - Server bootstrap
tests/
  expander.test.ts - Vitest + Supertest with local test servers
```

## Running
```bash
npm install
npm run dev
npm test
```

## Example Requests
```bash
curl -X POST http://localhost:3000/expand \
  -H "Content-Type: application/json" \
  -d '{"url":"https://t.co/shortlink"}'
```
