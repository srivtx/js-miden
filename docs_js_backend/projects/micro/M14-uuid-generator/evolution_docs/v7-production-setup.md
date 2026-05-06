# v7-production-setup.md — UUID Generator

## Final Production Setup

After evolving through 6 versions, here's the production-ready setup connecting to `src/`:

### `src/uuid.ts` (Current — production-ready)
```typescript
import { randomUUID } from "node:crypto";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateUUID(): string {
  return randomUUID();
}

export function isValidUUID(uuid: string): boolean {
  return UUID_V4_REGEX.test(uuid);
}
```

### `src/app.ts`
```typescript
import express, { Request, Response } from "express";
import { generateUUID, isValidUUID } from "./uuid.js";

export const app = express();
app.use(express.json());

app.post("/generate", (_req: Request, res: Response) => {
  const uuid = generateUUID();
  res.json({ uuid });
});

app.get("/validate/:uuid", (req: Request, res: Response) => {
  const { uuid } = req.params;
  const valid = isValidUUID(uuid);
  res.json({ uuid, valid });
});

if (import.meta.url.endsWith(process.argv[1] ?? "")) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`M14 UUID Generator running on port ${PORT}`);
  });
}
```

### `bug/bug.ts` (Intentional bugs for learning)
```typescript
function buggyGenerateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const BUGGY_UUID_REGEX = /^[0-9a-f-]{36}$/i;

function buggyIsValidUUID(uuid: string): boolean {
  return BUGGY_UUID_REGEX.test(uuid);
}
```

### Evolution Summary

| Version | Added | Bug Caught / Pain Solved |
|---------|-------|--------------------------|
| v1 | `Math.random()` UUID | Predictable, not cryptographically secure |
| v2 | TypeScript | Catches typos, branded UUID type |
| v3 | Strict validation | Rejects `gggg...` and UUID v1 as invalid |
| v4 | Structured logging | Tracks generation volume, validation failures |
| v5 | Tests | Documents `Math.random()` bug; enforces v4 format |
| v6 | ESM | Named imports from `uuid`/`ulidx`, top-level await |
| v7 | Production (`crypto.randomUUID` + v4/v7/ULID) | CSPRNG-backed, multiple formats |

### What Multiple UUID Formats Look Like

```typescript
import { randomUUID } from 'node:crypto';
import { v7 } from 'uuid';
import { ulid } from 'ulidx';

export type UUIDFormat = 'v4' | 'v7' | 'ulid';

export function generateUUID(format: UUIDFormat = 'v4'): string {
  switch (format) {
    case 'v4': return randomUUID();      // Random — security tokens
    case 'v7': return v7();              // Time-ordered — DB primary keys
    case 'ulid': return ulid();          // Lexicographically sortable — distributed systems
    default: throw new Error(`Unknown format: ${format}`);
  }
}
```

### Key Takeaway

UUID generation is a security-critical operation when UUIDs are used for authorization, session tokens, or resource identifiers. The difference between `Math.random()` and `crypto.randomUUID()` is the difference between "an attacker can predict the next ID" and "an attacker needs a supercomputer and 86 years." The evolution from naive JS to production ESM reflects the understanding that cryptographic primitives must be handled with cryptographic tools.
