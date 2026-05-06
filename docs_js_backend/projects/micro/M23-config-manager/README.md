# M23: Config Manager

A configuration manager with hot reload and intentional bugs to fix.

## Quick Start

```bash
npm install
npm test          # See failing tests
npm run build
npm start
```

## API

- `GET /config/:key` - Get config value
- `GET /config` - Get all config
- `POST /config` - Update single config
- `POST /config/bulk` - Update multiple configs

## Phases

### Phase 1: Basic Config Manager
Build a system that:
- Stores configuration in JSON file
- Returns values by key
- Supports updates via API
- Hot reloads without restart

### Phase 2-3: Advanced Concepts
- Config validation and type safety
- Secrets management
- Environment-specific configs
- Atomic file writes
- Schema enforcement

## Bugs

### Bug 1: No Validation
Accepts any JSON value without type checking. Setting a string where a number is expected causes crashes downstream.

### Bug 2: No Atomic Update
Writes directly to config file. A crash during write leaves the config partially corrupted.

## Docs

See the `docs/` folder for complete documentation.
