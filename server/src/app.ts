import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { sendSuccess } from './utils/response';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

export function createApp(): Application {
  const app: Application = express();

  // Security and utilities middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // Health check endpoints
  const healthHandler = (_req: Request, res: Response) => {
    return sendSuccess(res, {
      status: 'UP',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    }, 'POS Mavera API is healthy');
  };

  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // 404 and Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
