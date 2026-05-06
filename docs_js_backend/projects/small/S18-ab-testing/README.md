# S18: A/B Testing Backend

Backend for assigning users to experiment variants and tracking conversions.

## Features

- GET `/experiments/:name` - Assign variant (consistent for same user)
- POST `/experiments/:name/conversion` - Track conversion
- GET `/experiments/:name/stats` - Calculate statistics

## Bugs

1. **Non-deterministic Assignment**: `Math.random()` means same user gets different variants on refresh
2. **No Control Group**: Can't measure effect without control group

## Quick Start

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```
