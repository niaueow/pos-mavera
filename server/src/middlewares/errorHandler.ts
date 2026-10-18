import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { sendError, ApiErrorDetail } from '../utils/response';
import { env } from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: ApiErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function notFoundHandler(req: Request, res: Response): Response {
  return sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`);
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  if (env.NODE_ENV !== 'test') {
    console.error('⚠️ [Error]', err);
  }

  // Handle known AppError
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // Handle Zod validation error
  if (err instanceof ZodError) {
    const details: ApiErrorDetail[] = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, 422, 'VALIDATION_ERROR', 'Request validation failed', details);
  }

  // Handle Prisma known request error
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      return sendError(res, 409, 'CONFLICT', `Unique constraint violated on ${target}`);
    }
    if (err.code === 'P2025') {
      return sendError(res, 404, 'NOT_FOUND', 'Requested database record not found');
    }
    return sendError(res, 400, 'DATABASE_ERROR', 'Database operation failed');
  }

  // Handle SyntaxError (JSON parse failure)
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    return sendError(res, 400, 'BAD_REQUEST', 'Malformed JSON payload');
  }

  // Generic internal server error
  const message = env.NODE_ENV === 'production' ? 'An unexpected internal error occurred' : err.message;
  return sendError(res, 500, 'INTERNAL_ERROR', message);
}
