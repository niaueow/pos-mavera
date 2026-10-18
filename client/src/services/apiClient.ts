import { ApiErrorResponse, ApiSuccessResponse, ApiErrorDetail } from '../types/api';

export class ApiClientError extends Error {
  public statusCode: number;
  public code: string;
  public details?: ApiErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiSuccessResponse<T>> {
  const url = `${BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!response.ok) {
      if (isJson) {
        const errorData = (await response.json()) as ApiErrorResponse;
        throw new ApiClientError(
          response.status,
          errorData.error?.code || 'UNKNOWN_ERROR',
          errorData.error?.message || `Request failed with status ${response.status}`,
          errorData.error?.details
        );
      }
      throw new ApiClientError(
        response.status,
        'HTTP_ERROR',
        `Request failed with status ${response.status}`
      );
    }

    if (!isJson) {
      throw new ApiClientError(
        500,
        'INVALID_RESPONSE',
        'Server returned a non-JSON response'
      );
    }

    return (await response.json()) as ApiSuccessResponse<T>;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    // Network / offline error
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Gagal terhubung ke server. Periksa koneksi internet Anda atau pastikan server backend berjalan.'
    );
  }
}
