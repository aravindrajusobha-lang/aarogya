import { Request, Response, NextFunction } from 'express';
import { buildSuccessResponse, buildErrorResponse, EnvelopeMetaOptions } from '../utils/responseEnvelope.js';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
    interface Response {
      envelope: <T>(data: T, metaOptions?: EnvelopeMetaOptions) => Response;
      envelopeError: (
        code: string,
        message: string,
        details?: unknown,
        statusCode?: number,
        metaOptions?: EnvelopeMetaOptions
      ) => Response;
    }
  }
}

export function envelopeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] as string) || `req_${uuidv4()}`;
  req.id = reqId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', reqId);

  res.envelope = function <T>(data: T, metaOptions?: EnvelopeMetaOptions) {
    const payload = buildSuccessResponse(data, {
      requestId: req.id,
      ...metaOptions,
    });
    return res.status(res.statusCode || 200).json(payload);
  };

  res.envelopeError = function (
    code: string,
    message: string,
    details?: unknown,
    statusCode = 400,
    metaOptions?: EnvelopeMetaOptions
  ) {
    const payload = buildErrorResponse(code, message, details, {
      requestId: req.id,
      ...metaOptions,
    });
    return res.status(statusCode).json(payload);
  };

  next();
}

export function notFoundHandler(req: Request, res: Response): void {
  res.envelopeError('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`, undefined, 404);
}

export function errorHandler(
  err: Error & { statusCode?: number; code?: string; details?: unknown },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message = err.message || 'An unexpected error occurred';

  res.envelopeError(errorCode, message, err.details, statusCode);
}
