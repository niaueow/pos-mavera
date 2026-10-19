import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import { ApiClientError } from '../services/apiClient';
import { getLatestOrderReference, trackOrder } from '../services/orderService';
import { createPaymentAttempt } from '../services/paymentService';
import { useMidtransSnap } from '../hooks/useMidtransSnap';
import { PaymentStatus, TrackedOrderResponse, OrderStatus } from '../types/order';
import { formatIDR } from '../utils/currency';

const POLL_INTERVAL_MS = 10000;

function isTerminalOrder(status: OrderStatus, paymentStatus: PaymentStatus): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'CANCELLED' ||
    paymentStatus === 'FAILED' ||
    paymentStatus === 'EXPIRED' ||
    paymentStatus === 'CANCELLED'
  );
}

export function isPaymentAttemptEligible(order: Pick<TrackedOrderResponse, 'orderStatus' | 'paymentStatus'>): boolean {
  return order.paymentStatus !== 'PAID' && order.orderStatus === 'PENDING_PAYMENT';
}

export function canStartPaymentAttempt(
  order: Pick<TrackedOrderResponse, 'orderStatus' | 'paymentStatus'>,
  paymentInFlight: boolean
): boolean {
  return !paymentInFlight && isPaymentAttemptEligible(order);
}

function paymentLabel(status: PaymentStatus): string {
  switch (status) {
    case 'PAID':
      return 'Pembayaran terverifikasi';
    case 'FAILED':
      return 'Pembayaran gagal';
    case 'EXPIRED':
      return 'Pembayaran kedaluwarsa';
    case 'CANCELLED':
      return 'Pembayaran dibatalkan';
    default:
      return 'Menunggu pembayaran';
  }
}

export const TrackingPage: React.FC = () => {
  const { orderCode: routeOrderCode } = useParams<{ orderCode: string }>();
  const { pay } = useMidtransSnap();
  const [order, setOrder] = useState<TrackedOrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const requestInFlight = useRef(false);
  const paymentInFlight = useRef(false);

  const loadOrder = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setError(null);

    const reference = getLatestOrderReference();
    if (!reference) {
      setOrder(null);
      setError('Belum ada pesanan aktif di tab ini.');
      setIsLoading(false);
      requestInFlight.current = false;
      return;
    }

    if (routeOrderCode && routeOrderCode !== reference.orderCode) {
      setOrder(null);
      setError('Pesanan yang diminta bukan pesanan terakhir di tab ini.');
      setIsLoading(false);
      requestInFlight.current = false;
      return;
    }

    try {
      const result = await trackOrder(reference.orderCode, reference.trackingToken);
      setOrder(result);
    } catch (err) {
      setOrder(null);
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Gagal memuat status pesanan. Silakan coba lagi.');
      }
    } finally {
      setIsLoading(false);
      requestInFlight.current = false;
    }
  }, [routeOrderCode]);

  const handlePayNow = useCallback(async () => {
    if (!order || !canStartPaymentAttempt(order, paymentInFlight.current)) return;

    const reference = getLatestOrderReference();
    if (!reference || reference.orderCode !== order.orderCode) {
      setPaymentError('Token pelacakan pesanan tidak tersedia. Silakan buka pesanan terakhir di tab ini.');
      return;
    }

    paymentInFlight.current = true;
    setIsPaying(true);
    setPaymentError(null);
    try {
      const attempt = await createPaymentAttempt(reference.orderCode, reference.trackingToken);
      await new Promise<void>((resolve, reject) => {
        const refreshAndFinish = () => {
          void loadOrder().finally(resolve);
        };

        void pay(attempt.snapToken, {
          onSuccess: refreshAndFinish,
          onPending: refreshAndFinish,
          onError: () => {
            void loadOrder().finally(() => {
              setPaymentError('Pembayaran belum berhasil. Silakan coba lagi atau tunggu status diperbarui.');
              resolve();
            });
          },
          onClose: () => {
            void loadOrder().finally(() => {
              setPaymentError('Jendela pembayaran ditutup. Pesanan tetap menunggu pembayaran.');
              resolve();
            });
          },
        }).catch(reject);
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPaymentError(err.message);
      } else {
        setPaymentError('Gagal membuka pembayaran. Silakan coba lagi.');
      }
      void loadOrder();
    } finally {
      paymentInFlight.current = false;
      setIsPaying(false);
    }
  }, [loadOrder, order, pay]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!order || isTerminalOrder(order.orderStatus, order.paymentStatus)) return;
    const timer = window.setInterval(() => {
      void loadOrder();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadOrder, order]);

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <Loader2 className="w-7 h-7 animate-spin mx-auto text-amber-600" />
        <p className="mt-3 text-sm text-ink-muted">Memuat status pesanan...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <AlertCircle className="w-9 h-9 mx-auto text-amber-600" />
          <h1 className="mt-3 text-lg font-bold text-ink">Pesanan tidak dapat dibuka</h1>
          <p className="mt-2 text-sm text-ink-muted">{error}</p>
          <Link to="/" className="inline-flex mt-5 px-4 py-2 rounded-xl bg-brand text-ink text-sm font-bold">
            Kembali ke katalog
          </Link>
        </div>
      </div>
    );
  }

  const terminal = isTerminalOrder(order.orderStatus, order.paymentStatus);
  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted mb-4">
        <ArrowLeft className="w-4 h-4" /> Kembali ke katalog
      </Link>
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-ink-muted">Kode pesanan</p>
            <h1 className="text-xl font-extrabold text-ink">{order.orderCode}</h1>
          </div>
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>

        <div className="rounded-xl bg-brand-subtle border border-brand/30 p-4">
          <p className="text-xs font-semibold text-ink-muted">Status pembayaran</p>
          <p className="mt-1 text-base font-bold text-ink">{paymentLabel(order.paymentStatus)}</p>
          <p className="mt-1 text-sm text-ink-muted">{order.status}</p>
        </div>

        {isPaymentAttemptEligible(order) && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handlePayNow()}
              disabled={isPaying}
              className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-extrabold text-ink transition-smooth hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPaying ? 'Membuka pembayaran...' : 'Bayar Sekarang'}
            </button>
            {paymentError && <p className="text-xs text-danger">{paymentError}</p>}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock3 className="w-4 h-4 text-amber-600" />
          {terminal ? 'Status pesanan sudah final' : 'Status akan diperbarui otomatis'}
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="text-ink-muted">{item.quantity}x {item.menuName}</span>
              <span className="font-semibold text-ink">{formatIDR(item.subtotal)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2 text-sm font-extrabold">
            <span>Total</span>
            <span>{formatIDR(order.totalAmount)}</span>
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
};
