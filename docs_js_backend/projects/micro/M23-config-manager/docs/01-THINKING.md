# THINKING: Config Manager

## Mental Models

### The Recipe Book Model

Your config file is a recipe book. Your application is a chef. If the recipe says "bake at 'hot' degrees" instead of "bake at 350 degrees," the chef can't cook. The config manager is the recipe editor that ensures all recipes use valid units before the chef sees them.

### The Flight Controls Model

Configuration is like the cockpit of an airplane. Pilots (operators) adjust settings (config) in real-time. The plane (application) responds immediately. But if a pilot accidentally moves the flaps to "banana" instead of "15 degrees," the plane shouldn't accept it.

### The Contract Model

Your application has a contract with its configuration:
- `api.port` must be a number between 1024-65535
- `db.host` must be a non-empty string
- `features.cacheEnabled` must be a boolean

The config manager enforces this contract at write time, not at read time. Fail fast on invalid input.

## Hot Path (What Happens on Every Request)

```
GET /config/api.port
    |
    v
[Parse key from URL]
    |
    v
[Look up in cache] --missing?--> Return 404
    |
    v
Return JSON { key, value }
```

O(1) Map lookup. No file I/O on reads.

```
POST /config { key: "api.port", value: 8080 }
    |
    v
[Parse request body]
    |
    v
[Validate value] --invalid?--> Return 400
    |
    v
[Update cache]
    |
    v
[Write to file] --non-atomic?--> CORRUPTION RISK
    |
    v
Return 200 { key, value }
```

File write is the danger zone.

## Danger Zones

### 1. Non-Atomic File Write (Our Bug)

`fs.writeFile` truncates the file before writing. If the process crashes mid-write, the file is half-written or empty.

**Scenario:**
```
T+0ms: fs.writeFile starts
T+1ms: File is truncated (0 bytes)
T+2ms: Process crashes
T+3ms: File is 0 bytes. Application can't start.
```

### 2. No Type Validation (Our Bug)

`api.port = "not-a-number"` is accepted. Later:
```typescript
server.listen(config.get('api.port')); // TypeError: "not-a-number" is not a number
```

The crash happens far from the cause, making debugging difficult.

### 3. Race Condition on Concurrent Writes

Two requests update config simultaneously:
```
Request A: read file -> modify X -> write file
Request B: read file -> modify Y -> write file
```

If the interleaving is:
```
A reads
B reads
A modifies X
B modifies Y
A writes (includes X, not Y)
B writes (includes Y, not X)  <-- X is lost!
```

### 4. Circular JSON

```typescript
const obj: any = { a: 1 };
obj.self = obj;
await manager.set('circular', obj); // JSON.stringify throws
```

### 5. Large Config Files

If config grows to 100MB, `JSON.parse` blocks the event loop.

## What-If Game

### What if the config file is corrupted?

Application fails to start. DevOps scrambles. If no backup exists, configuration must be reconstructed from memory or documentation.

### What if validation rejects a valid value?

Developer frustration. They can't update config via API. They edit the file directly, bypassing validation. Now the file has an invalid value that passes validation on next read (because validation only happens on API writes, not file loads).

### What if we need environment-specific config?

`config.json` is shared. We need `config.development.json`, `config.production.json`. The manager should support environment-specific files or overlays.

### What if we need secrets?

Config file shouldn't contain passwords. We need integration with secret managers (AWS Secrets Manager, HashiCorp Vault).

### What if we need config history?

Who changed `api.port` from 3000 to 8080? When? Why? We need an audit log or Git-based config.

### What if the application is distributed across 10 servers?

Each server has its own `config.json`. Changing config on one server doesn't affect others. We need a centralized config service (Consul, etcd) or config distribution mechanism.
