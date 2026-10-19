import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      trackingToken?: string;
    }
  }
}

/**
 * Middleware to require and extract the X-Order-Tracking-Token header
 * for guest customer order tracking endpoint.
 */
export function requireTrackingToken(req: Request, res: Response, next: NextFunction): void {
  const tokenHeader = req.headers['x-order-tracking-token'];

  if (!tokenHeader || typeof tokenHeader !== 'string' || tokenHeader.trim() === '') {
    sendError(
      res,
      401,
      'UNAUTHORIZED',
      'Header X-Order-Tracking-Token diperlukan untuk mengakses pelacakan pesanan'
    );
    return;
  }

  req.trackingToken = tokenHeader.trim();
  next();
}
