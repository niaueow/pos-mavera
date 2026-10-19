import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

/**
 * In-memory rate limiter for login attempts (10 attempts per minute per IP)
 */
export function loginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  // Disable in test environment to avoid test flakiness
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxAttempts = 10;

  const record = loginAttempts.get(clientIp);

  if (!record || now > record.resetTime) {
    loginAttempts.set(clientIp, { count: 1, resetTime: now + windowMs });
    next();
    return;
  }

  record.count += 1;

  if (record.count > maxAttempts) {
    sendError(
      res,
      429,
      'TOO_MANY_REQUESTS',
      'Terlalu banyak percobaan masuk. Silakan tunggu beberapa saat lagi.'
    );
    return;
  }

  next();
}

const orderAttempts = new Map<string, RateLimitRecord>();

/**
 * In-memory rate limiter for guest order creation (20 orders per minute per IP)
 */
export function orderCreationRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxAttempts = 20;

  const record = orderAttempts.get(clientIp);

  if (!record || now > record.resetTime) {
    orderAttempts.set(clientIp, { count: 1, resetTime: now + windowMs });
    next();
    return;
  }

  record.count += 1;

  if (record.count > maxAttempts) {
    sendError(
      res,
      429,
      'TOO_MANY_REQUESTS',
      'Terlalu banyak permintaan pembuatan pesanan. Silakan tunggu beberapa saat lagi.'
    );
    return;
  }

  next();
}

