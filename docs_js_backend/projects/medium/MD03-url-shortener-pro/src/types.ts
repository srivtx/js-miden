import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export interface CreateUrlInput {
  originalUrl: string;
  customAlias?: string;
  expiresAt?: string;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}
