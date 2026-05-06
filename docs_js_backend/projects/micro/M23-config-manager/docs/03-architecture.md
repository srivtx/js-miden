# Architecture: Config Manager

## Components

### ConfigManager Class
- `configPath`: Path to JSON file
- `cache`: In-memory Map of key-value pairs

### Persistence Layer
- Load: Read JSON from disk on startup
- Save: Write JSON to disk on update

### Validation Layer (Phase 2)
- Schema definition per key
- Type checking on write
- Range validation for numbers

### Express Routes
- `GET /config/:key` - Read single value
- `GET /config` - Read all values
- `POST /config` - Write single value
- `POST /config/bulk` - Write multiple values

## Data Flow

1. Server starts → load config.json into cache
2. Client GET /config/:key → return from cache
3. Client POST /config → validate → update cache → save to disk
4. On save failure → rollback cache

## Atomic Writes

```
// Correct approach:
1. Write to config.json.tmp
2. fsync the temp file
3. Rename config.json.tmp to config.json
4. On crash: old config.json is intact
```

## Hot Reload

```
// Watch config.json for changes
fs.watch(configPath, () => {
  manager.load(); // Reload into cache
});
```

## Secrets Management (Phase 3)

- Never store plaintext secrets in config.json
- Use environment variables for secrets
- Support encrypted values with KMS
