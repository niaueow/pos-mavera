import { apiRequest } from './apiClient';
import { ApiSuccessResponse } from '../types/api';

export interface ActiveOrderItem {
  id: number;
  menu_id: number | null;
  name?: string;
  menu_name: string;
  unit_price: number;
  quantity: number;
  spice_level: number | null;
  notes: string | null;
  subtotal: number;
}

export interface OrderStatusLogItem {
  id: number;
  previous_status: string | null;
  new_status: string;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

export interface ActiveOrder {
  id: number;
  order_id?: number;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  order_type: 'DINE_IN' | 'TAKEAWAY' | string;
  table_number: number | null;
  total?: number;
  total_amount: number;
  order_status: 'PENDING_PAYMENT' | 'RECEIVED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | string;
  payment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: ActiveOrderItem[];
  status_logs?: OrderStatusLogItem[];
}

export interface OrderStatusMeta {
  label: string;
  badgeClass: string;
  columnPillClass: string;
  nextStatus: string | null;
  nextLabel: string | null;
  buttonClass: string;
}

export const ORDER_STATUS_CONFIG: Record<string, OrderStatusMeta> = {
  RECEIVED: {
    label: 'Diterima',
    badgeClass: 'bg-[#FFF3C4] text-[#8F6B00] border-[#F5DC7B]',
    columnPillClass: 'bg-[#FFF3C4] text-[#8F6B00]',
    nextStatus: 'PREPARING',
    nextLabel: 'Proses Makanan',
    buttonClass: 'bg-brand hover:bg-brand-hover text-ink',
  },
  PREPARING: {
    label: 'Sedang Dimasak',
    badgeClass: 'bg-[#E0EAFF] text-[#1D4ED8] border-[#BFDBFE]',
    columnPillClass: 'bg-[#E0EAFF] text-[#1D4ED8]',
    nextStatus: 'READY',
    nextLabel: 'Siap Diambil',
    buttonClass: 'bg-brand hover:bg-brand-hover text-ink',
  },
  READY: {
    label: 'Siap Diambil',
    badgeClass: 'bg-[#D8F3E5] text-[#007A4C] border-[#A7F3D0]',
    columnPillClass: 'bg-[#D8F3E5] text-[#007A4C]',
    nextStatus: 'COMPLETED',
    nextLabel: 'Tandai Selesai',
    buttonClass: 'bg-[#007A4C] hover:bg-[#00633D] text-white',
  },
  COMPLETED: {
    label: 'Selesai',
    badgeClass: 'bg-surface-muted text-ink-muted border-border',
    columnPillClass: 'bg-surface-muted text-ink-muted',
    nextStatus: null,
    nextLabel: null,
    buttonClass: 'bg-surface-muted text-ink-muted',
  },
};

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  return ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.RECEIVED;
}

export function formatTableLabel(orderType: string, tableNumber: number | null): string {
  if (orderType === 'DINE_IN' && tableNumber !== null && tableNumber !== undefined) {
    return `Meja ${String(tableNumber).padStart(2, '0')}`;
  }
  return 'Takeaway';
}

export function formatRelativeMinutes(isoDate: string, nowMs = Date.now()): {
  text: string;
  minutes: number;
  urgencyClass: string;
} {
  const createdMs = new Date(isoDate).getTime();
  const diffMinutes = Math.max(0, Math.floor((nowMs - createdMs) / 60000));

  const text = diffMinutes === 0 ? 'Baru saja' : `${diffMinutes} mnt lalu`;
  let urgencyClass = 'text-ink-muted';
  if (diffMinutes >= 20) {
    urgencyClass = 'text-danger font-bold';
  } else if (diffMinutes >= 10) {
    urgencyClass = 'text-[#D97706] font-bold';
  }

  return { text, minutes: diffMinutes, urgencyClass };
}

/**
 * GET /api/v1/staff/orders — Fetch active/unfinished orders for staff operational board
 */
export async function getActiveOrders(
  token: string,
  status?: string
): Promise<ApiSuccessResponse<ActiveOrder[]>> {
  const qs = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<ActiveOrder[]>(`staff/orders${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * GET /api/v1/staff/orders/:id — Fetch detailed order with items and status audit logs
 */
export async function getOrderById(
  token: string,
  orderId: number
): Promise<ApiSuccessResponse<ActiveOrder>> {
  return apiRequest<ActiveOrder>(`staff/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * PATCH /api/v1/staff/orders/:id/status — Advance order status
 */
export async function updateOrderStatus(
  token: string,
  orderId: number,
  status: string,
  reason?: string
): Promise<ApiSuccessResponse<{ order_id: number; order_code: string; order_status: string; updated_at: string }>> {
  return apiRequest(`staff/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(reason ? { status, reason } : { status }),
  });
}
