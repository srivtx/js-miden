# 06-BUGS

## Intentional Bug: Sequential Short Codes

### Description
The shortener uses a simple incrementing counter encoded in Base62 instead of a random generator. This makes every short URL predictable (`b`, `c`, `d`...).

### Location
`src/services/shortener.ts`:
```typescript
let counter = 0;
function encode(num: number): string { ... }
const shortCode = customCode || encode(++counter);
```

### Real-World Impact
- An attacker can enumerate all short URLs by iterating the sequence.
- Private documents, invoices, and personal links become publicly accessible.
- Reputational damage and data leakage (GDPR/CCPA violations).
- Brute-force scraping becomes trivial.

### Fix
```typescript
import { nanoid } from 'nanoid';
const shortCode = customCode || nanoid(10);
```
