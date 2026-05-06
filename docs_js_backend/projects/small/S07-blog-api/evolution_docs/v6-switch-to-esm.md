# v6 — Switching to ESM

You're copy-pasting a StackOverflow snippet for reading a file path relative to your script:

```js
const path = require('path');
const fs = require('fs');
const data = fs.readFileSync(path.join(__dirname, '../data.json'));
```

It works in CommonJS. But your project is mixed. Some files use `require`, some use `import`. Your `tsconfig.json` has `"module": "ESNext"` but Node complains about `.js` extensions. You're in module hell.

## The Fix: Go All-In on ESM

ESM is the 2025 standard. Node supports it natively. TypeScript supports it. Every modern bundler supports it.

```json
// package.json
{
  "type": "module"
}
```

```ts
// db.ts
import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_URL || join(__dirname, '../../blog.db');
```

Yes, `__dirname` is annoying in ESM. But you write it once, put it in a utility, and never think about it again.

## Why ESM?

- **Tree-shaking** — dead code elimination actually works
- **Top-level await** — cleaner async initialization
- **No `require.cache` hacks** — predictable module loading
- **Future-proof** — CommonJS is in maintenance mode

## Migration Tips

1. Add `"type": "module"` to `package.json`
2. Use `.js` extensions in all imports (TypeScript handles the mapping)
3. Replace `__dirname` with `fileURLToPath(import.meta.url)`
4. Use `node:` prefixes for built-ins (`node:path`, `node:fs`)

## The New Pain

Your app works locally. Your tests pass. But in production, the database connection pool is too small, you have no error handling for crashes, and the process dies on an unhandled promise rejection.

**Next:** Let's productionize this thing.
