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
      envelope: <T>(data: T, metaOptions?: EnvelopeMetaOptions | string, statusCode?: number) => Response;
      envelopeError: (
        code: string,
        message: string,
        details?: unknown,
        statusCode?: number,
        metaOptions?: EnvelopeMetaOptions | string
      ) => Response;
    }
  }
}

export function envelopeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] as string) || `req_${uuidv4()}`;
  req.id = reqId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', reqId);

  res.envelope = function <T>(data: T, metaOptions?: EnvelopeMetaOptions | string, statusCode?: number) {
    const opts = typeof metaOptions === 'string' ? { message: metaOptions } : metaOptions;
    const finalStatus = statusCode || res.statusCode || 200;
    const payload = buildSuccessResponse(data, {
      requestId: req.id,
      ...opts,
    });
    return res.status(finalStatus).json(payload);
  };

  res.envelopeError = function (
    code: string,
    message: string,
    details?: unknown,
    statusCode?: number,
    metaOptions?: EnvelopeMetaOptions | string
  ) {
    const opts = typeof metaOptions === 'string' ? { message: metaOptions } : metaOptions;
    const finalStatus = statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 400);
    const payload = buildErrorResponse(code, message, details, {
      requestId: req.id,
      ...opts,
    });
    return res.status(finalStatus).json(payload);
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

  if (statusCode === 500) {
    console.error('Unhandled internal error in errorHandler:', err);
  }

  if (typeof res.envelopeError === 'function') {
    res.envelopeError(errorCode, message, err.details, statusCode);
  } else {
    res.status(statusCode).json({
      success: false,
      error: { code: errorCode, message, details: err.details },
      simulation: true,
    });
  }
}
