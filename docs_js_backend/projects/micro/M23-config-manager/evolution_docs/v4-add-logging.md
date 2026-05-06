# v4: Add Logging — Config Manager

## The Pain

Production is down. The config says `database_timeout: 30`. You don't know if that's 30 milliseconds or 30 seconds. You check the file — it was updated 3 hours ago. You don't know who updated it or what it was before. The last deploy was 6 hours ago, so it wasn't a code change.

You SSH into the server. There are no logs. The config file just exists, with no history, no audit trail, no context. You are debugging in the dark.

## The Solution

Add structured logging to every config operation.

## Before (No Logs)

```typescript
// src/config-manager.ts
async load(): Promise<void> {
  try {
    const data = await fs.readFile(this.configPath, 'utf-8');
    const parsed = JSON.parse(data);
    this.cache = new Map(Object.entries(parsed));
  } catch {
    this.cache = new Map();
  }
}

async set(key: string, value: any): Promise<void> {
  this.cache.set(key, value);
  await this.save();
}
```

## After (With Logging)

```typescript
// src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

```typescript
// src/config-manager.ts
import { logger } from './logger.js';

async load(): Promise<void> {
  try {
    const data = await fs.readFile(this.configPath, 'utf-8');
    const parsed = JSON.parse(data);
    this.cache = new Map(Object.entries(parsed));
    logger.info({ keys: this.cache.size, path: this.configPath }, 'Config loaded');
  } catch (err) {
    this.cache = new Map();
    logger.warn({ err, path: this.configPath }, 'Config file missing, starting empty');
  }
}

async set(key: string, value: any): Promise<void> {
  const oldValue = this.cache.get(key);
  this.cache.set(key, value);
  await this.save();
  logger.info({ key, oldValue, newValue: value }, 'Config value updated');
}

async save(): Promise<void> {
  const obj = Object.fromEntries(this.cache);
  const json = JSON.stringify(obj, null, 2);
  await fs.writeFile(this.configPath, json, 'utf-8');
  logger.debug({ path: this.configPath, bytes: json.length }, 'Config saved');
}
```

## What the Logs Look Like

```json
{"level":30,"time":1715200000000,"keys":12,"path":"/app/config.json","msg":"Config loaded"}
{"level":30,"time":1715200005000,"key":"api.timeout","oldValue":5000,"newValue":30,"msg":"Config value updated"}
{"level":20,"time":1715200005001,"path":"/app/config.json","bytes":420,"msg":"Config saved"}
```

## Why Logging Matters

- **Audit trail**: Every change is logged with old → new value
- **Debugging**: "Config loaded with 12 keys" tells you the file was read successfully
- **Error detection**: "Config file missing" tells you the path is wrong
- **Performance**: Log file size to detect config bloat

Without logs, a config change is invisible. With logs, you grep `api.timeout` and see exactly when it changed from `5000` to `30` — and realize someone typed milliseconds instead of seconds.
