import { apiRequest } from './apiClient';
import { CartItem } from '../types/cart';
import {
  CreateOrderPayload,
  CreateOrderResponse,
  OrderType,
  TrackedOrderResponse,
} from '../types/order';

export const LAST_ORDER_STORAGE_KEY = 'pos_mavera_last_order_v1';
export const VALID_TABLE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface CheckoutFormInput {
  customerName: string;
  phoneNumber: string;
  orderType: OrderType;
  tableNumber: number | null;
  notes?: string;
  items: CartItem[];
}

export interface CheckoutValidationResult {
  isValid: boolean;
  errors: {
    customerName?: string;
    phoneNumber?: string;
    tableNumber?: string;
    items?: string;
  };
}

/**
 * Formats a raw Indonesian phone input (e.g. "81234567890" or "081234567890")
 * into a clean digits-only string with +62 or 08 prefix accepted by the backend.
 */
export function normalizeCustomerPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return digits;
  }
  return `+62${digits}`;
}

/**
 * Validates customer checkout form inputs before sending to POST /api/v1/orders.
 */
export function validateCheckoutForm(input: CheckoutFormInput): CheckoutValidationResult {
  const errors: CheckoutValidationResult['errors'] = {};

  const trimmedName = input.customerName.trim();
  if (!trimmedName) {
    errors.customerName = 'Nama pemesan wajib diisi';
  } else if (trimmedName.length > 100) {
    errors.customerName = 'Nama pemesan maksimal 100 karakter';
  }

  const rawDigits = input.phoneNumber.replace(/\D/g, '');
  if (!rawDigits) {
    errors.phoneNumber = 'Nomor WhatsApp / HP wajib diisi';
  } else if (rawDigits.length < 8 || rawDigits.length > 18) {
    errors.phoneNumber = 'Nomor telepon harus terdiri dari 8–18 digit angka';
  }

  if (input.orderType === 'DINE_IN') {
    if (
      input.tableNumber === null ||
      input.tableNumber === undefined ||
      !Number.isInteger(input.tableNumber) ||
      input.tableNumber < 1 ||
      input.tableNumber > 10
    ) {
      errors.tableNumber = 'Nomor meja wajib dipilih (Meja 1–10) untuk pesanan Dine-in';
    }
  }

  if (!input.items || input.items.length === 0) {
    errors.items = 'Keranjang pesanan masih kosong';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Builds the authoritative request payload for POST /api/v1/orders.
 * Notice: Table number is strictly null when orderType is TAKEAWAY.
 */
export function buildCreateOrderPayload(input: CheckoutFormInput): CreateOrderPayload {
  const normalizedPhone = normalizeCustomerPhone(input.phoneNumber);
  const trimmedNotes = input.notes?.trim() ? input.notes.trim() : null;

  return {
    customer_name: input.customerName.trim(),
    customer_phone: normalizedPhone,
    order_type: input.orderType,
    table_number: input.orderType === 'DINE_IN' ? input.tableNumber : null,
    notes: trimmedNotes,
    items: input.items.map((item) => ({
      menu_id: item.menuItem.id,
      quantity: item.quantity,
      spice_level: item.menuItem.has_spice_level
        ? (item.spiceLevel ?? 0)
        : null,
      notes: item.notes?.trim() ? item.notes.trim() : null,
    })),
  };
}

/**
 * Calls POST /api/v1/orders to create a new customer order.
 */
export async function createOrder(
  payload: CreateOrderPayload
): Promise<CreateOrderResponse> {
  const response = await apiRequest<CreateOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  try {
    sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(response.data));
    localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(response.data));
  } catch {
    // Ignore storage quota errors
  }

  return response.data;
}

export const TRACKING_TOKEN_STORAGE_PREFIX = 'pos_mavera_tracking_token_';

/**
 * Saves tracking token and last order reference in localStorage.
 */
export function saveTrackingToken(orderCode: string, trackingToken: string): void {
  try {
    localStorage.setItem(`${TRACKING_TOKEN_STORAGE_PREFIX}${orderCode}`, trackingToken);
    localStorage.setItem('pos_mavera_last_order_code', orderCode);
    localStorage.setItem('pos_mavera_last_tracking_token', trackingToken);
  } catch {
    // Ignore storage quota
  }
}

/**
 * Retrieves stored tracking token for a given orderCode.
 */
export function getStoredTrackingToken(orderCode?: string): string | null {
  try {
    if (orderCode) {
      const specific = localStorage.getItem(`${TRACKING_TOKEN_STORAGE_PREFIX}${orderCode}`);
      if (specific) return specific;
    }
    return localStorage.getItem('pos_mavera_last_tracking_token');
  } catch {
    return null;
  }
}

/**
 * Calls GET /api/v1/orders/:orderCode with X-Order-Tracking-Token header
 * to fetch real-time order status and details.
 */
export async function trackOrder(
  orderCode: string,
  trackingToken: string
): Promise<TrackedOrderResponse> {
  const cleanTrackingToken = trackingToken.trim();
  if (!cleanTrackingToken) {
    throw new Error('Token pelacakan pesanan tidak tersedia');
  }

  const cleanOrderCode = encodeURIComponent(orderCode.trim());
  const response = await apiRequest<TrackedOrderResponse>(`/orders/${cleanOrderCode}`, {
    method: 'GET',
    headers: {
      'X-Order-Tracking-Token': cleanTrackingToken,
    },
  });

  return response.data;
}
