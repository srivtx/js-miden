# v6 — Switching to ESM

You're trying to use the `undici` HTTP client in your URL expander. It's ESM-only.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module undici not supported
```

You could use Node's built-in `fetch` (available in modern Node), but your test setup is mixed CommonJS/ESM and everything is confusing.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// follower.ts
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
```

## Why ESM?

- **Modern HTTP clients work** — `undici`, `fetch`, ESM-only libraries
- **Top-level await** — clean async initialization
- **Static analysis** — bundlers can optimize
- **No `__dirname` hacks needed** — use `import.meta.url`

## Migration

- Add `"type": "module"` to `package.json`
- Use `.js` extensions in imports
- Use `node:` prefixes for built-ins

**Next:** Production setup.
