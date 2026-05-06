# S20: API Versioning

API with multiple versions via URL path and Accept header.

## Features

- `/v1/users` returns `{ name }`
- `/v2/users` returns `{ firstName, lastName }`
- Version via URL path and Accept header

## Bugs

1. **Breaking Change Without Version Bump**: v1 starts returning new format, breaks clients
2. **No Deprecation Notice**: Clients never know to migrate

## Quick Start

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```
