import { apiRequest } from './apiClient';
import { MenuItem, MenuQueryFilter } from '../types/menu';
import { ApiSuccessResponse } from '../types/api';

export async function getMenus(
  filters?: MenuQueryFilter
): Promise<ApiSuccessResponse<MenuItem[]>> {
  const params = new URLSearchParams();

  if (filters?.search && filters.search.trim() !== '') {
    params.append('search', filters.search.trim());
  }

  if (filters?.category && filters.category !== 'Semua') {
    params.append('category', filters.category);
  }

  if (filters?.page) {
    params.append('page', filters.page.toString());
  }

  if (filters?.limit) {
    params.append('limit', filters.limit.toString());
  }

  const queryString = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<MenuItem[]>(`menus${queryString}`);
}

export async function getMenuById(id: number): Promise<ApiSuccessResponse<MenuItem>> {
  return apiRequest<MenuItem>(`menus/${id}`);
}
