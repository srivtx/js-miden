# 05-BUILD.md

## Step-by-Step Build Instructions

### Prerequisites

- Node.js 20+
- npm 10+

### Step 1: Initialize Project

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/small/S18-ab-testing
npm install
```

Dependencies installed:
- `express` — HTTP server
- `typescript`, `tsx` — TypeScript compilation

### Step 2: Understand the File Structure

```
S18-ab-testing/
├── src/
│   ├── store.ts    # Experiment storage, assignment, stats (BUGGY)
│   ├── routes.ts   # HTTP routes
│   └── index.ts    # Express app setup
├── tests/
│   ├── store.test.ts
│   └── routes.test.ts
└── docs/
    └── ...
```

### Step 3: Review the Experiment Store

```typescript
// src/store.ts

interface Experiment {
  name: string;
  variants: string[];
  // BUG: No control group!
}

interface Assignment {
  userId: string;
  experiment: string;
  variant: string;
  timestamp: string;
}

interface Conversion {
  userId: string;
  experiment: string;
  value: number;
  timestamp: string;
}
```

### Step 4: Run the Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Step 5: Test the API

```bash
# Assign variant (BUG: non-deterministic)
curl "http://localhost:3000/experiments/button-color?userId=alice"

# Track conversion
curl -X POST http://localhost:3000/experiments/button-color/conversion \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","value":1}'

# Get stats (BUG: no control group, no significance test)
curl http://localhost:3000/experiments/button-color/stats
```

### Step 6: Run Tests (Two Should Fail)

```bash
npm test
```

Expected output:
```
✓ getStats returns experiment data
✗ assignVariant is deterministic for same user (Math.random bug)
✗ experiment has a control group (missing control bug)
```

### Step 7: Fix Bug 1 — Non-Deterministic Assignment

**File**: `src/store.ts`

**WRONG** (current):
```typescript
export function assignVariant(experimentName: string, userId: string): string {
  const experiment = experiments.get(experimentName);
  if (!experiment) return 'control';
  
  // BUG: Math.random() changes on every call!
  const randomIndex = Math.floor(Math.random() * experiment.variants.length);
  const variant = experiment.variants[randomIndex];
  // ...
}
```

**RIGHT** (fix):
```typescript
import { createHash } from 'crypto';

export function assignVariant(experimentName: string, userId: string): string {
  const experiment = experiments.get(experimentName);
  if (!experiment) return 'control';
  
  // Deterministic hash-based assignment
  const hash = createHash('sha256')
    .update(`${experimentName}:${userId}`)
    .digest('hex');
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  
  const variantIndex = Math.floor(bucket / (100 / experiment.variants.length));
  const variant = experiment.variants[variantIndex];
  
  assignments.push({
    userId,
    experiment: experimentName,
    variant,
    timestamp: new Date().toISOString(),
  });
  
  return variant;
}
```

### Step 8: Fix Bug 2 — No Control Group

**File**: `src/store.ts`

**WRONG** (current initialization):
```typescript
experiments.set('button-color', {
  name: 'button-color',
  variants: ['red', 'blue'],  // Both are treatments! No baseline.
});
```

**RIGHT** (fix):
```typescript
experiments.set('button-color', {
  name: 'button-color',
  variants: ['control', 'red', 'blue'],  // Control is the baseline
});
```

Also update `getStats()` to calculate lift and significance:

```typescript
export function getStats(experimentName: string): Record<string, unknown> | null {
  const experiment = experiments.get(experimentName);
  if (!experiment) return null;
  
  const expAssignments = assignments.filter(a => a.experiment === experimentName);
  const expConversions = conversions.filter(c => c.experiment === experimentName);
  
  const controlVariant = experiment.variants[0];
  const controlUsers = expAssignments.filter(a => a.variant === controlVariant);
  const controlConversions = expConversions.filter(c => {
    return controlUsers.some(u => u.userId === c.userId);
  });
  const controlRate = controlUsers.length > 0 
    ? controlConversions.length / controlUsers.length 
    : 0;
  
  const stats: Record<string, unknown> = {
    experiment: experimentName,
    totalUsers: expAssignments.length,
    control: {
      variant: controlVariant,
      users: controlUsers.length,
      conversions: controlConversions.length,
      conversionRate: controlRate,
    },
    variants: experiment.variants.slice(1).map(v => {
      const variantUsers = expAssignments.filter(a => a.variant === v);
      const variantConversions = expConversions.filter(c => {
        return variantUsers.some(u => u.userId === c.userId);
      });
      const variantRate = variantUsers.length > 0 
        ? variantConversions.length / variantUsers.length 
        : 0;
      
      return {
        name: v,
        users: variantUsers.length,
        conversions: variantConversions.length,
        conversionRate: variantRate,
        relativeLift: controlRate > 0 
          ? ((variantRate - controlRate) / controlRate) 
          : 0,
      };
    }),
  };
  
  return stats;
}
```

### Step 9: Verify Fixes

```bash
npm test
# All tests should pass now
```

### Step 10: Experiment

```bash
# Assign variant (should be deterministic)
curl "http://localhost:3000/experiments/button-color?userId=alice"
curl "http://localhost:3000/experiments/button-color?userId=alice"
# Both should return the same variant!

# Simulate traffic
for user in user{1..100}; do
  variant=$(curl -s "http://localhost:3000/experiments/button-color?userId=$user" | jq -r '.variant')
  if [ "$variant" != "control" ] && [ $((RANDOM % 2)) -eq 0 ]; then
    curl -s -X POST http://localhost:3000/experiments/button-color/conversion \
      -d "{\"userId\":\"$user\",\"value\":1}"
  fi
done

# Check stats
curl http://localhost:3000/experiments/button-color/stats | jq
```
