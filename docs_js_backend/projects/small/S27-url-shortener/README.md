# S27 URL Shortener

Bit.ly clone with custom short codes, expiration, analytics, rate limiting, and collision handling.

## Features

- Short URL generation and redirect
- Custom short codes
- Expiration dates
- Click analytics (referrers, IPs)
- Rate limiting per IP

## Intentional Bug

Sequential short codes (`a1`, `a2`, `a3`...) make all links predictable and enumerable.

## Scripts

```bash
npm run dev       # Start development server
npm test          # Run Vitest tests (includes bug reproduction)
npm run build     # Compile TypeScript
```

## Docker

```bash
docker-compose up -d
```
