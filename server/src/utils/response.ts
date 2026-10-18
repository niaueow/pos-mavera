import { Response } from 'express';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total_items?: number;
    total_pages?: number;
  };
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: ApiSuccessResponse<T>['meta']
): Response {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    message,
    data,
  };
  if (meta) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: ApiErrorDetail[]
): Response {
  const payload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };
  if (details && details.length > 0) {
    payload.error.details = details;
  }
  return res.status(statusCode).json(payload);
}
