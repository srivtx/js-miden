import { Request, Response, NextFunction } from 'express';

export function depthLimit(maxDepth: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // BUG: No depth limit enforcement
    // This middleware does nothing - recursive queries are not blocked
    // A query like { posts { author { posts { author { ... } } } } } will succeed
    next();
  };
}
