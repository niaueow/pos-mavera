import { apiRequest, ApiClientError } from './apiClient';
import { ApiSuccessResponse } from '../types/api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'STAFF' | 'ADMIN' | 'OWNER';
}

export interface LoginResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export async function loginUser(
  email: string,
  password: string
): Promise<ApiSuccessResponse<LoginResult>> {
  return apiRequest<LoginResult>('auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCurrentUser(token: string): Promise<ApiSuccessResponse<AuthUser>> {
  return apiRequest<AuthUser>('auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export { ApiClientError };
