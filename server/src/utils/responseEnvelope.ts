import { ApiResponse, ApiResponseMeta, ApiError } from '../types/envelope.js';
import { v4 as uuidv4 } from 'uuid';

export interface EnvelopeMetaOptions {
  requestId?: string;
  is_mock?: boolean;
  adapter_status?: 'MOCK' | 'DEMO AI' | 'BLOCKED' | 'REAL';
  [key: string]: unknown;
}

export function createResponseMeta(options: EnvelopeMetaOptions = {}): ApiResponseMeta {
  const { requestId = `req_${uuidv4()}`, is_mock, adapter_status, ...rest } = options;
  return {
    timestamp: new Date().toISOString(),
    requestId,
    simulation: true,
    environment: process.env.NODE_ENV || 'simulation-demo',
    ...(is_mock !== undefined ? { is_mock } : {}),
    ...(adapter_status ? { adapter_status } : {}),
    ...rest,
  };
}

export function buildSuccessResponse<T>(data: T, metaOptions?: EnvelopeMetaOptions): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: createResponseMeta(metaOptions),
  };
}

export function buildErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  metaOptions?: EnvelopeMetaOptions
): ApiResponse<null> {
  const errorObj: ApiError = {
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  };

  return {
    success: false,
    data: null,
    error: errorObj,
    meta: createResponseMeta(metaOptions),
  };
}
