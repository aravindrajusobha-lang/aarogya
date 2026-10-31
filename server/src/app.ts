import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { envelopeMiddleware, notFoundHandler, errorHandler } from './middleware/envelope.js';
import { requestLogger } from './middleware/requestLogger.js';
import { healthRouter } from './modules/health/healthRoutes.js';
import { storageRouter } from './modules/storage/storageRoutes.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  // CORS
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept-Language'],
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Standard response envelope & request ID
  app.use(envelopeMiddleware);

  // Request logger (Pino with strict redaction)
  app.use(requestLogger);

  // Mount API Routes
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/storage', storageRouter);

  // 404 Handler (returns standard envelope)
  app.use(notFoundHandler);

  // Global Error Handler (returns standard envelope)
  app.use(errorHandler);

  return app;
}
