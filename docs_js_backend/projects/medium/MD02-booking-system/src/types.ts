import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export interface BookingInput {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  timezone?: string;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}
