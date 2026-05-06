# Requirements: Config Manager

## Functional Requirements

1. **Key-Value Storage**: Store and retrieve configuration by key.

2. **JSON Persistence**: Save config to JSON file on disk.

3. **Hot Reload**: Read latest config without restart.

4. **Validation**: Reject invalid config values (wrong types, malformed data).

5. **Bulk Updates**: Update multiple keys atomically.

## API Requirements

- `GET /config/:key` - Get value by key
- `GET /config` - Get all config
- `POST /config` - Set single key
- `POST /config/bulk` - Set multiple keys

## Non-Functional Requirements

- Atomic writes (no partial corruption)
- Type-safe reads
- Fast access (< 1ms for cached values)
- Human-readable JSON format

## Acceptance Criteria

- [ ] Can set and get config values
- [ ] Config persists to disk
- [ ] Returns 404 for missing keys
- [ ] Rejects string when number expected
- [ ] Bulk updates are atomic
- [ ] Invalid JSON is rejected
