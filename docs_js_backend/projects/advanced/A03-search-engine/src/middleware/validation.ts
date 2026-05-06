import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const indexDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(50000),
  tags: z.array(z.string().min(1).max(50)).optional(),
});

export const validateIndexDocument = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    indexDocumentSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(50000).optional(),
  tags: z.array(z.string().min(1).max(50)).optional(),
});

export const validateUpdateDocument = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    updateDocumentSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};
