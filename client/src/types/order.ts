export type OrderType = 'DINE_IN' | 'TAKEAWAY';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'RECEIVED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';

export interface CreateOrderItemPayload {
  menu_id: number;
  quantity: number;
  spice_level: number | null;
  notes?: string | null;
}

export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  order_type: OrderType;
  table_number: number | null;
  notes?: string | null;
  items: CreateOrderItemPayload[];
}

export interface CreatedOrderItem {
  id: number;
  menu_id: number;
  name: string;
  menu_name: string;
  unit_price: number;
  quantity: number;
  spice_level: number | null;
  notes: string | null;
  subtotal: number;
}

export interface CreateOrderResponse {
  id: number;
  order_id: number;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  order_type: OrderType;
  table_number: number | null;
  items: CreatedOrderItem[];
  total: number;
  total_amount: number;
  notes: string | null;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  tracking_token: string;
  created_at: string;
  updated_at: string;
}
