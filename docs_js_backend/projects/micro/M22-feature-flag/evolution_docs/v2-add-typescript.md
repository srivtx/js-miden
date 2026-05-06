# v2: Add TypeScript — Feature Flag Service

## The Pain

You write the feature flag service in JavaScript:

```javascript
// src/feature-flag.js
class FeatureFlagService {
  constructor() {
    this.flags = new Map();
  }

  setFlag(flag) {
    this.flags.set(flag.name, flag);
  }

  isEnabled(flagName, userId) {
    const flag = this.flags.get(flagName);
    if (!flag) return false;
    // BUG: Typo — rolloutPercentage vs rolloutPercent
    if (flag.rolloutPercent > 0) {
      return Math.random() * 100 <= flag.rolloutPercent;
    }
    return true;
  }
}
```

The typo `rolloutPercent` vs `rolloutPercentage` compiles and runs. It silently returns `undefined > 0` which is `false`. The rollout feature never works. You don't know why until you add `console.log(flag)` and see the property names.

## The Solution

Add TypeScript. Define interfaces. Let the compiler catch typos.

## After (With TypeScript)

```typescript
// src/feature-flag.ts
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  userIds?: string[];
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();

  setFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, flag);
  }

  isEnabled(flagName: string, userId?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;
    if (!flag.enabled) return false;

    // TypeScript catches this immediately:
    // Property 'rolloutPercent' does not exist on type 'FeatureFlag'.
    if (flag.rolloutPercentage > 0) {
      const randomValue = Math.random() * 100;
      return randomValue <= flag.rolloutPercentage;
    }

    return true;
  }
}
```

## The Bug TypeScript Catches

- `flag.rolloutPercent` → `Property 'rolloutPercent' does not exist on type 'FeatureFlag'. Did you mean 'rolloutPercentage'?`
- `this.flags.set(flag.name, flag.name)` → `Argument of type 'string' is not assignable to parameter of type 'FeatureFlag'`
- `isEnabled(123)` → `Argument of type 'number' is not assignable to parameter of type 'string'`
- `setFlag({ name: 'x' })` → `Property 'enabled' is missing in type '{ name: string; }' but required in type 'FeatureFlag'`

## Why TypeScript Matters

- **Typos**: The compiler suggests the correct property name
- **Contracts**: `FeatureFlag` interface documents the exact shape
- **Refactoring**: Rename `rolloutPercentage` → `rolloutPercent` and every call site updates
- **IDE support**: Autocomplete shows `rolloutPercentage`, not every string in the project

Without TypeScript, a typo costs hours of debugging. With TypeScript, it costs 0 seconds — the compiler catches it before you run.
