export function validateConfig(config: any): { valid: boolean; error?: string } {
  if (typeof config !== 'object' || config === null) {
    return { valid: false, error: 'Config must be an object' };
  }

  for (const [key, value] of Object.entries(config)) {
    if (typeof key !== 'string' || key.length === 0) {
      return { valid: false, error: 'Keys must be non-empty strings' };
    }
    if (value === null || value === undefined) {
      return { valid: false, error: `Value for ${key} cannot be null or undefined` };
    }
  }

  return { valid: true };
}
