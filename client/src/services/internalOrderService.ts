import { apiRequest } from './apiClient';
import { ApiSuccessResponse } from '../types/api';

export interface ActiveOrder {
  id: number;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  order_type: string;
  table_number: number | null;
  total_amount: number;
  order_status: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: {
    id: number;
    menu_id: number | null;
    menu_name: string;
    unit_price: number;
    quantity: number;
    spice_level: number | null;
    notes: string | null;
    subtotal: number;
  }[];
}

export async function getActiveOrders(
  token: string,
  status?: string
): Promise<ApiSuccessResponse<ActiveOrder[]>> {
  const qs = status ? `?status=${status}` : '';
  return apiRequest<ActiveOrder[]>(`internal/orders${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateOrderStatus(
  token: string,
  orderId: number,
  status: string
): Promise<ApiSuccessResponse<{ order_id: number; order_status: string; updated_at: string }>> {
  return apiRequest(`internal/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
}
