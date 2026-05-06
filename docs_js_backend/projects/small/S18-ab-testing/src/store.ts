import { createHash } from 'crypto';

interface Experiment {
  name: string;
  variants: string[];
  // BUG: No control group field - all users get a treatment
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

const experiments: Map<string, Experiment> = new Map();
const assignments: Assignment[] = [];
const conversions: Conversion[] = [];

// Initialize with one experiment
experiments.set('button-color', {
  name: 'button-color',
  variants: ['red', 'blue'],
  // Missing control group!
});

export function assignVariant(experimentName: string, userId: string): string {
  const experiment = experiments.get(experimentName);
  if (!experiment) return 'control';
  
  // BUG: Non-deterministic assignment using Math.random()
  // Should use hash(userId + experimentName) for consistency
  const randomIndex = Math.floor(Math.random() * experiment.variants.length);
  const variant = experiment.variants[randomIndex];
  
  assignments.push({
    userId,
    experiment: experimentName,
    variant,
    timestamp: new Date().toISOString(),
  });
  
  return variant;
}

export function trackConversion(experimentName: string, userId: string, value: number): void {
  conversions.push({
    userId,
    experiment: experimentName,
    value,
    timestamp: new Date().toISOString(),
  });
}

export function getStats(experimentName: string): Record<string, unknown> | null {
  const experiment = experiments.get(experimentName);
  if (!experiment) return null;
  
  const expAssignments = assignments.filter(a => a.experiment === experimentName);
  const expConversions = conversions.filter(c => c.experiment === experimentName);
  
  // BUG: No control group means can't calculate lift
  const stats: Record<string, unknown> = {
    experiment: experimentName,
    totalUsers: expAssignments.length,
    variants: experiment.variants.map(v => {
      const variantUsers = expAssignments.filter(a => a.variant === v).length;
      const variantConversions = expConversions.filter(c => {
        const assignment = expAssignments.find(a => a.userId === c.userId && a.variant === v);
        return assignment !== undefined;
      });
      const totalValue = variantConversions.reduce((sum, c) => sum + c.value, 0);
      return {
        name: v,
        users: variantUsers,
        conversions: variantConversions.length,
        conversionRate: variantUsers > 0 ? variantConversions.length / variantUsers : 0,
        totalValue,
      };
    }),
    // BUG: No control group stats, no statistical significance test
  };
  
  return stats;
}
