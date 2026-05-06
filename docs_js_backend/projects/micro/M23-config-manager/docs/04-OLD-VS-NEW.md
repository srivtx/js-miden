# OLD vs NEW: Config Manager

## Pattern 1: Hardcoded Constants (2015)

### Old Code

```typescript
// config.ts (2015)
export const API_PORT = 3000;
export const DB_HOST = 'localhost';
export const DB_PORT = 5432;
export const CACHE_ENABLED = true;

// server.ts
import { API_PORT } from './config';
server.listen(API_PORT);
```

**Why it was done:** Simple, type-safe, fast. No external dependencies.

**Why it's wrong now:**
- Requires rebuild and redeploy to change any value
- Can't vary by environment without conditional compilation
- Secrets in code (security risk)
- No runtime flexibility

### New Code (2025)

```typescript
// config-manager.ts (2025)
export class ConfigManager {
  private cache: Map<string, any> = new Map();
  private configPath: string;

  constructor(configPath: string = './config.json') {
    this.configPath = path.resolve(configPath);
  }

  async load(): Promise<void> {
    const data = await fs.readFile(this.configPath, 'utf-8');
    this.cache = new Map(Object.entries(JSON.parse(data)));
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.cache.set(key, value);
    await this.save();
  }

  private async save(): Promise<void> {
    const obj = Object.fromEntries(this.cache);
    const json = JSON.stringify(obj, null, 2);
    const tmpPath = `${this.configPath}.tmp`;
    await fs.writeFile(tmpPath, json);
    await fs.rename(tmpPath, this.configPath);
  }
}

// server.ts
const config = new ConfigManager();
await config.load();
server.listen(config.get('api.port'));
```

**Why it's better:**
- Change config without redeployment
- Environment-specific files
- Runtime validation
- Atomic writes prevent corruption

---

## Pattern 2: Environment Variables Only (2015-2018)

### Old Code

```typescript
// config.ts (2017)
export const config = {
  port: parseInt(process.env.PORT || '3000'),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: parseInt(process.env.DB_PORT || '5432'),
  cacheEnabled: process.env.CACHE_ENABLED === 'true',
};
```

**Why it was done:** 12-Factor App methodology recommends env vars for config.

**Why it's wrong now:**
- No typing (everything is string)
- No validation ("PORT=abc" causes NaN)
- Hard to manage many variables
- No defaults visible in code
- Difficult to change at runtime
- Secrets visible in process list (`ps aux`)

### New Code (2025)

```typescript
// config.ts (2025)
import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.number().min(1024).max(65535).default(3000),
  db: z.object({
    host: z.string().min(1).default('localhost'),
    port: z.number().min(1).max(65535).default(5432),
  }),
  cache: z.object({
    enabled: z.boolean().default(true),
  }),
});

// Load from file + env vars, validate
const raw = {
  port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
  },
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true' ? true : undefined,
  },
};

export const config = ConfigSchema.parse(raw);
```

**Why it's better:**
- Type-safe (inferred from schema)
- Validated at startup (fail fast)
- Clear defaults
- Rich error messages

---

## Pattern 3: Global Config Object (2016-2020)

### Old Code

```typescript
// config.ts (2018)
let config: any = {};

export function loadConfig(path: string): void {
  const data = fs.readFileSync(path, 'utf-8');
  config = JSON.parse(data);
}

export function getConfig(): any {
  return config;
}

// Any file can import and mutate:
import { getConfig } from './config';
getConfig().api.port = 9999; // Global mutation!
```

**Why it was done:** Simple singleton pattern. Any module can access config.

**Why it's wrong now:**
- Global mutable state
- No encapsulation
- Race conditions
- Impossible to test in isolation
- Side effects across modules

### New Code (2025)

```typescript
// config-manager.ts (2025)
export class ConfigManager {
  private cache: Map<string, any> = new Map();
  private readonly schemas: Map<string, ConfigSchema> = new Map();

  get<T>(key: string): T | undefined {
    return this.cache.get(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.validate(key, value);
    this.cache.set(key, value);
    await this.save();
  }
}

// Dependency injection
import { ConfigManager } from './config-manager';

class DatabaseService {
  constructor(private config: ConfigManager) {}

  connect() {
    const host = this.config.get<string>('db.host');
    const port = this.config.get<number>('db.port');
    // ...
  }
}
```

**Why it's better:**
- Immutable from consumer perspective
- Encapsulated logic
- Testable (inject mock ConfigManager)
- No global state

---

## Pattern 4: File-Based vs Centralized Config Service (2015-2020 vs 2025)

### Old Approach: Local Config Files (2015-2020)

Each server has its own config file. Deploy via configuration management (Ansible, Chef, Puppet).

```yaml
# ansible playbook
- name: Deploy config
  template:
    src: config.json.j2
    dest: /app/config.json
  notify: restart app
```

**Why it was done:** Standard ops practice. Config managed by infrastructure tools.

**Why it's wrong now:**
- Restart required on every change
- Config drift across servers
- No real-time updates
- Hard to audit changes

### New Approach: Centralized Config Service (2025)

```typescript
// 2025: Consul or etcd integration
import { ConsulConfig } from '@company/config';

const config = new ConsulConfig({
  host: 'consul.company.internal',
  prefix: 'my-app',
  watch: true, // Hot reload
});

await config.ready();

const port = config.get<number>('api.port');

// Update from anywhere
await config.set('api.port', 8080); // All instances get update within seconds
```

**Why it's better:**
- No restarts
- All instances synchronized
- Audit trail
- Access control
- Version history

**Popular tools in 2025:**
- **Consul**: HashiCorp's service discovery + config
- **etcd**: Kubernetes' backing store, distributed and reliable
- **AWS AppConfig**: Managed service with deployment strategies
- **Azure App Configuration**: Similar to AWS AppConfig
