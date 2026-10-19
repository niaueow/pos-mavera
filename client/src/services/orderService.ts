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

export interface LatestOrderReference {
  orderCode: string;
  trackingToken: string;
  savedAt: number;
}

let latestOrderFallback: LatestOrderReference | null = null;

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
 * Formats phone input into the digits-only string accepted by checkout.
 * The original digits, including leading zeros, are preserved.
 */
export function normalizeCustomerPhone(rawPhone: string): string {
  return rawPhone.replace(/\D/g, '').slice(0, 14);
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
  } else if (rawDigits.length < 8 || rawDigits.length > 14) {
    errors.phoneNumber = 'Nomor telepon harus terdiri dari 8–14 digit angka';
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

  saveLatestOrderReference(response.data.order_code, response.data.tracking_token);

  return response.data;
}

/**
 * Saves only the current tab's latest order tracking reference.
 */
export function saveLatestOrderReference(orderCode: string, trackingToken: string): void {
  const cleanOrderCode = orderCode.trim();
  const cleanTrackingToken = trackingToken.trim();
  if (!cleanOrderCode || !cleanTrackingToken) return;

  const reference: LatestOrderReference = {
    orderCode: cleanOrderCode,
    trackingToken: cleanTrackingToken,
    savedAt: Date.now(),
  };
  latestOrderFallback = reference;

  try {
    sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(reference));
  } catch {
    // In-memory fallback remains available for this page session.
  }
}

/**
 * Retrieves and validates the current tab's latest order tracking reference.
 */
export function getLatestOrderReference(): LatestOrderReference | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(LAST_ORDER_STORAGE_KEY);
  } catch {
    return latestOrderFallback;
  }

  if (!raw) return latestOrderFallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as LatestOrderReference).orderCode === 'string' &&
      (parsed as LatestOrderReference).orderCode.trim() !== '' &&
      typeof (parsed as LatestOrderReference).trackingToken === 'string' &&
      (parsed as LatestOrderReference).trackingToken.trim() !== '' &&
      Number.isFinite((parsed as LatestOrderReference).savedAt) &&
      (parsed as LatestOrderReference).savedAt > 0
    ) {
      const reference = {
        orderCode: (parsed as LatestOrderReference).orderCode.trim(),
        trackingToken: (parsed as LatestOrderReference).trackingToken.trim(),
        savedAt: (parsed as LatestOrderReference).savedAt,
      };
      latestOrderFallback = reference;
      return reference;
    }
  } catch {
    // Remove malformed data below.
  }

  try {
    sessionStorage.removeItem(LAST_ORDER_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
  latestOrderFallback = null;
  return null;
}

export function clearLatestOrderReference(): void {
  latestOrderFallback = null;
  try {
    sessionStorage.removeItem(LAST_ORDER_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
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
  const cleanTrackingToken =
    typeof trackingToken === 'string' ? trackingToken.trim() : '';
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
