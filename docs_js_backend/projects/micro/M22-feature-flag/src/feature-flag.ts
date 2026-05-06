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

  getFlag(name: string): FeatureFlag | undefined {
    return this.flags.get(name);
  }

  isEnabled(flagName: string, userId?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;
    if (!flag.enabled) return false;

    // User-specific override
    if (userId && flag.userIds?.includes(userId)) {
      return true;
    }

    // BUG: Random rollout instead of consistent hashing!
    // User gets different result on every request
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
