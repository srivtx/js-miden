# HOW: Config Server

## How the Config Server Works

### 1. Storage Structure (Intended)

Configuration is stored in a nested structure:

```typescript
{
  "myapp": {
    "dev": { "dbHost": "localhost", "debug": true },
    "prod": { "dbHost": "prod-db.example.com", "debug": false }
  }
}
```

### 2. Setting Config

```bash
POST /config/myapp/prod
{ "dbHost": "prod-db.example.com", "apiKey": "secret123" }
```

The server should merge the new values into the existing config for that app and environment.

### 3. Getting Config

```bash
GET /config/myapp/prod
```

Returns the configuration for `myapp` in the `prod` environment.

### 4. Validation (Intended)

Before storing, the server should validate:
- Keys are non-empty strings
- Values are primitive types (string, number, boolean)
- No `null` or `undefined` values

## File Breakdown

| File | Purpose |
|------|---------|
| `src/index.ts` | Express app, config routes |
| `src/config.ts` | In-memory config store, get/set operations |
| `src/validator.ts` | Validates incoming configuration values |

## Running the Config Server

```bash
npm run dev

# Set config
curl -X POST http://localhost:3000/config/myapp/dev \
  -H "Content-Type: application/json" \
  -d '{"dbHost":"localhost","debug":true}'

# Get config
curl http://localhost:3000/config/myapp/dev
```
