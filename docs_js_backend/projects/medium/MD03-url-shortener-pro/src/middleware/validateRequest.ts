import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../types.js';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const error = new Error(
        result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      ) as ApiError;
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      return next(error);
    }

    next();
  };
}
