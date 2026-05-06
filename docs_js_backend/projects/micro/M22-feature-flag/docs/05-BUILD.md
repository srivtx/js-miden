# BUILD: Feature Flag

## Step-by-Step from Empty Folder

### Step 0: Create Project Directory

```bash
mkdir M22-feature-flag
cd M22-feature-flag
npm init -y
```

### Step 1: Install Dependencies

```bash
npm install express@^5.0.0
npm install -D typescript@^5.4.0 @types/node@^20.0.0 @types/express@^5.0.0 \
  jest@^29.7.0 @types/jest@^29.5.0 ts-jest@^29.1.0 supertest@^7.0.0 \
  @types/supertest@^6.0.0
```

**Why each dependency:**
- `express`: HTTP server framework
- `typescript`: Type safety
- `@types/*`: Type definitions
- `jest` + `ts-jest`: Test runner for TypeScript
- `supertest`: HTTP assertions for Express routes

### Step 2: Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Why `module: "NodeNext"`:** Required for ES modules with Node.js.

### Step 3: Configure Jest

```javascript
// jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testTimeout: 10000,
};
```

### Step 4: Create the Feature Flag Service

```typescript
// src/feature-flag.ts

/**
 * FeatureFlag represents the configuration for a single feature.
 */
export interface FeatureFlag {
  name: string;                  // Unique identifier
  enabled: boolean;              // Master switch
  rolloutPercentage: number;     // 0-100, percentage of users
  userIds?: string[];            // Specific user overrides
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();

  setFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, flag);
  }

  getFlag(name: string): FeatureFlag | undefined {
    return this.flags.get(name);
  }

  /**
   * Determine if a feature is enabled for a specific user.
   * 
   * Priority order:
   * 1. Missing flag → false
   * 2. Disabled flag → false
   * 3. User-specific override → true
   * 4. Percentage rollout → deterministic hash
   * 5. Default → true (flag exists, enabled, no rollout)
   */
  isEnabled(flagName: string, userId?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;
    if (!flag.enabled) return false;

    // User-specific override
    if (userId && flag.userIds?.includes(userId)) {
      return true;
    }

    // BUG: Random rollout instead of consistent hashing!
    // See 06-BUGS.md for details.
    if (flag.rolloutPercentage > 0) {
      const randomValue = Math.random() * 100;
      return randomValue <= flag.rolloutPercentage;
    }

    return true;
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }
}
```

**Key design choices explained:**
- `Map<string, FeatureFlag>`: O(1) lookups, preserves insertion order
- `isEnabled(flagName, userId?)`: Optional userId supports anonymous users
- Priority chain: Missing → Disabled → Override → Rollout → Default

### Step 5: Create the Express Server

```typescript
// src/index.ts
import express from 'express';
import { FeatureFlagService } from './feature-flag.js';

const app = express();
app.use(express.json());

const service = new FeatureFlagService();

// Seed some flags
service.setFlag({ name: 'dark-mode', enabled: true, rolloutPercentage: 10 });
service.setFlag({ name: 'new-checkout', enabled: false, rolloutPercentage: 0 });

app.get('/flags/:flag', (req, res) => {
  const { flag } = req.params;
  const userId = req.query.userId as string | undefined;
  const enabled = service.isEnabled(flag, userId);
  const flagConfig = service.getFlag(flag);

  res.json({
    flag,
    enabled,
    userId,
    rolloutPercentage: flagConfig?.rolloutPercentage ?? 0,
  });
});

app.get('/flags', (req, res) => {
  const userId = req.query.userId as string | undefined;
  const flags = service.getAllFlags().map(f => ({
    name: f.name,
    enabled: service.isEnabled(f.name, userId),
    rolloutPercentage: f.rolloutPercentage,
  }));
  res.json({ flags });
});

app.post('/flags/:flag', (req, res) => {
  const { flag } = req.params;
  const { enabled, rolloutPercentage, userIds } = req.body;
  service.setFlag({ name: flag, enabled, rolloutPercentage, userIds });
  res.json({ flag, enabled, rolloutPercentage });
});

export { app, service };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Feature flag service running on port ${PORT}`);
  });
}
```

**Route design explained:**
- `GET /flags/:flag`: Evaluate single flag for a user
- `GET /flags`: Evaluate all flags for a user (dashboard use)
- `POST /flags/:flag`: Create or update a flag

### Step 6: Write Tests

```typescript
// tests/feature-flag.test.ts
import request from 'supertest';
import { app, service } from '../src/index.js';

describe('Feature Flag', () => {
  beforeEach(() => {
    service.setFlag({ name: 'test-flag', enabled: true, rolloutPercentage: 50 });
  });

  it('should return disabled for non-existent flag', async () => {
    const res = await request(app).get('/flags/nonexistent');
    expect(res.body.enabled).toBe(false);
  });

  it('should return consistent result for same user', async () => {
    const userId = 'user-123';
    const results: boolean[] = [];

    // Same user should always get same result
    for (let i = 0; i < 20; i++) {
      const res = await request(app).get(`/flags/test-flag?userId=${userId}`);
      results.push(res.body.enabled);
    }

    const allSame = results.every(r => r === results[0]);
    expect(allSame).toBe(true);
  });

  it('should allow user-specific override', async () => {
    service.setFlag({
      name: 'test-flag',
      enabled: true,
      rolloutPercentage: 0,
      userIds: ['admin-1'],
    });

    const res = await request(app).get('/flags/test-flag?userId=admin-1');
    expect(res.body.enabled).toBe(true);
  });

  it('should respect disabled flag', async () => {
    service.setFlag({ name: 'disabled-flag', enabled: false, rolloutPercentage: 100 });
    const res = await request(app).get('/flags/disabled-flag?userId=anyone');
    expect(res.body.enabled).toBe(false);
  });

  it('should support gradual percentage rollout', async () => {
    service.setFlag({ name: 'gradual', enabled: true, rolloutPercentage: 10 });

    let enabledCount = 0;
    const totalUsers = 100;

    for (let i = 0; i < totalUsers; i++) {
      const res = await request(app).get(`/flags/gradual?userId=user-${i}`);
      if (res.body.enabled) enabledCount++;
    }

    // Should be roughly 10% with consistent hashing
    const percentage = (enabledCount / totalUsers) * 100;
    expect(percentage).toBeGreaterThanOrEqual(5);
    expect(percentage).toBeLessThanOrEqual(15);
  });
});
```

### Step 7: Run and Verify

```bash
npm run build
npm test
npm start
```

**Expected test results:** `should return consistent result for same user` will fail due to the intentional Math.random() bug.
