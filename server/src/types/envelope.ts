export interface ApiResponseMeta {
  timestamp: string;
  requestId: string;
  simulation: true;
  environment: string;
  is_mock?: boolean;
  adapter_status?: 'MOCK' | 'DEMO AI' | 'BLOCKED' | 'REAL';
  [key: string]: unknown;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ApiErrorDetail[] | unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ApiResponseMeta;
}
