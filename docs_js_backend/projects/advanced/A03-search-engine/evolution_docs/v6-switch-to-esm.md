# v6 — Switching to ESM

You're trying to use `flexsearch` for in-memory indexing. It's ESM-only.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module flexsearch not supported
```

Your search engine is CommonJS. Every modern search library is ESM. Time to switch.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// indexer.ts
import { Document } from 'flexsearch';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const index = new Document({
  document: {
    id: 'id',
    index: ['name', 'description'],
  },
});
```

## Why ESM?

- **Modern search libraries work** — `flexsearch`, `minisearch`, ESM-only packages
- **Top-level await** — clean async initialization for index loading
- **Static analysis** — bundlers can tree-shake when you split indexer from search API
- **`node:` prefixes** — clear built-in vs npm imports

## Migration

- Add `"type": "module"` to `package.json`
- Use `.js` extensions in all imports
- Replace `__dirname` with `import.meta.url`

**Next:** Production setup — inverted index, BM25, highlighting, faceting, and service split.
