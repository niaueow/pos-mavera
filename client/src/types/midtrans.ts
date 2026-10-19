export interface SnapCallbacks {
  onSuccess?: (result: SnapResult) => void;
  onPending?: (result: SnapResult) => void;
  onError?: (result: SnapResult) => void;
  onClose?: () => void;
}

export interface SnapResult {
  status_code?: string;
  status_message?: string;
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  payment_type?: string;
  transaction_time?: string;
  transaction_status?: 'capture' | 'settlement' | 'pending' | 'deny' | 'cancel' | 'expire' | 'refund';
  fraud_status?: string;
  pdf_url?: string;
  finish_redirect_url?: string;
  [key: string]: unknown;
}

export interface SnapOptions extends SnapCallbacks {
  embedId?: string;
  uiMode?: 'deeplink' | 'qr' | 'standard';
}

export interface MidtransSnapInstance {
  pay: (snapToken: string, options?: SnapCallbacks) => void;
  embed?: (snapToken: string, options?: SnapOptions) => void;
}

export interface PaymentAttemptData {
  paymentAttemptId: number;
  orderCode: string;
  gatewayOrderId: string;
  snapToken: string;
  snapRedirectUrl: string;
  expiresAt: string;
}

declare global {
  interface Window {
    snap?: MidtransSnapInstance;
  }
}
