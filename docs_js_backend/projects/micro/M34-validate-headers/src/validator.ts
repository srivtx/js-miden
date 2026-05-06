import { Request, Response, NextFunction } from 'express';

export type ValidationMode = 'strict' | 'lenient';

export interface HeaderRule {
  name: string;
  required: boolean;
  pattern?: RegExp;
  validate?: (value: string) => boolean;
}

export const defaultRules: HeaderRule[] = [
  {
    name: 'Content-Type',
    required: false,
    pattern: /^(application\/json|text\/plain|application\/xml)(;.*)?$/,
  },
  {
    name: 'Authorization',
    required: false,
    pattern: /^Bearer\s+\S+$/,
  },
];

export function validateHeaders(
  rules: HeaderRule[],
  mode: ValidationMode = 'lenient'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const rule of rules) {
      // BUG: Case-sensitive header lookup.
      // HTTP headers are case-insensitive per RFC 2616, but here we use exact case.
      const value = req.headers[rule.name];

      if (rule.required && (value === undefined || value === '')) {
        errors.push(`Missing required header: ${rule.name}`);
        continue;
      }

      if (value && typeof value === 'string') {
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`Invalid format for header ${rule.name}: ${value}`);
        }
        if (rule.validate && !rule.validate(value)) {
          errors.push(`Validation failed for header ${rule.name}`);
        }
      }
    }

    if (errors.length > 0 && mode === 'strict') {
      const err: any = new Error('Header validation failed');
      err.status = 400;
      err.details = errors;
      next(err);
      return;
    }

    if (errors.length > 0 && mode === 'lenient') {
      (req as any).headerWarnings = errors;
    }

    next();
  };
}
