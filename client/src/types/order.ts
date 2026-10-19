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

export interface TrackedOrderItem {
  id: number;
  menuId: number;
  menuName: string;
  unitPrice: number;
  quantity: number;
  spiceLevel: number | null;
  notes: string | null;
  subtotal: number;
}

export interface TrackedOrderResponse {
  id: number;
  orderCode: string;
  order_code?: string;
  customerName: string;
  customer_name?: string;
  orderType: OrderType;
  order_type?: OrderType;
  tableNumber: number | null;
  table_number?: number | null;
  totalPrice: number;
  totalAmount: number;
  total_amount?: number;
  paymentStatus: PaymentStatus;
  payment_status?: PaymentStatus;
  orderStatus: OrderStatus;
  order_status?: OrderStatus;
  status: string;
  display_status?: string;
  items: TrackedOrderItem[];
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
}
