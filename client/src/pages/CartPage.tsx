import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  FileText,
  UtensilsCrossed,
  ShoppingBag,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { formatIDR } from '../utils/currency';
import { OrderType } from '../types/order';
import {
  VALID_TABLE_NUMBERS,
  validateCheckoutForm,
  buildCreateOrderPayload,
  createOrder,
} from '../services/orderService';
import { createPaymentAttempt } from '../services/paymentService';
import {
  getCustomerSession,
  saveCustomerSession,
} from '../services/customerSession';
import { useMidtransSnap } from '../hooks/useMidtransSnap';
import { ApiClientError } from '../services/apiClient';

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { pay } = useMidtransSnap();
  const { items, subtotalAmount, updateQuantity, removeItem, clearCart } = useCart();

  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState(
    () => getCustomerSession()?.name ?? ''
  );
  const [phoneNumber, setPhoneNumber] = useState(
    () => getCustomerSession()?.phone ?? ''
  );
  const [orderNotes, setOrderNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{
    type: 'warning' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [pendingOrderInfo, setPendingOrderInfo] = useState<{
    orderCode: string;
    trackingToken: string;
    totalAmount?: number;
  } | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    customerName?: string;
    phoneNumber?: string;
    tableNumber?: string;
  }>({});

  const validation = validateCheckoutForm({
    customerName,
    phoneNumber,
    orderType,
    tableNumber,
    notes: orderNotes,
    items,
  });

  const handleOrderTypeChange = (nextType: OrderType) => {
    setOrderType(nextType);
    setSubmitError(null);
    if (nextType === 'TAKEAWAY') {
      setTableNumber(null);
      setFieldErrors((prev) => ({ ...prev, tableNumber: undefined }));
    }
  };

  const handleTableNumberChange = (nextTable: number | null) => {
    setTableNumber(nextTable);
    setSubmitError(null);
    setFieldErrors((prev) => ({ ...prev, tableNumber: undefined }));
  };

  const handleCheckoutSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitError(null);

    const check = validateCheckoutForm({
      customerName,
      phoneNumber,
      orderType,
      tableNumber,
      notes: orderNotes,
      items,
    });

    if (!check.isValid) {
      setFieldErrors(check.errors);
      if (check.errors.items) {
        setSubmitError(check.errors.items);
      }
      return;
    }

    setFieldErrors({});
    setPaymentNotice(null);
    setIsSubmitting(true);

    try {
      const payload = buildCreateOrderPayload({
        customerName,
        phoneNumber,
        orderType,
        tableNumber,
        notes: orderNotes,
        items,
      });

      const createdOrder = await createOrder(payload);

      setPendingOrderInfo({
        orderCode: createdOrder.order_code,
        trackingToken: createdOrder.tracking_token,
        totalAmount: createdOrder.total_amount,
      });
      clearCart();

      // Trigger Midtrans Snap payment attempt
      try {
        const attempt = await createPaymentAttempt(
          createdOrder.order_code,
          createdOrder.tracking_token
        );
        await pay(attempt.snapToken, {
          onSuccess: () => {
            navigate(`/tracking/${createdOrder.order_code}`);
          },
          onPending: () => {
            navigate(`/tracking/${createdOrder.order_code}`);
          },
          onError: () => {
            setPaymentNotice({
              type: 'error',
              message:
                'Pembayaran belum berhasil diselesaikan. Anda dapat mencoba bayar kembali atau memeriksa status pesanan.',
            });
          },
          onClose: () => {
            setPaymentNotice({
              type: 'warning',
              message:
                'Jendela pembayaran ditutup sebelum transaksi selesai. Pesanan Anda tersimpan dan menunggu pembayaran.',
            });
          },
        });
      } catch (payErr: any) {
        setPaymentNotice({
          type: 'error',
          message:
            payErr?.message ||
            'Gagal membuka formulir pembayaran Midtrans. Silakan lanjutkan pembayaran dari halaman pelacakan pesanan.',
        });
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details && err.details.length > 0) {
          setSubmitError(err.details.map((d) => d.message).join(' • '));
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError('Terjadi kesalahan saat memproses pesanan. Silakan coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayPendingOrder = async () => {
    if (!pendingOrderInfo) return;
    if (
      !pendingOrderInfo.orderCode ||
      typeof pendingOrderInfo.trackingToken !== 'string' ||
      !pendingOrderInfo.trackingToken.trim()
    ) {
      setPaymentNotice({
        type: 'error',
        message: 'Token pelacakan pesanan tidak tersedia. Silakan buat pesanan kembali.',
      });
      return;
    }

    setIsRetryingPayment(true);
    setPaymentNotice(null);
    try {
      const attempt = await createPaymentAttempt(
        pendingOrderInfo.orderCode,
        pendingOrderInfo.trackingToken
      );
      await pay(attempt.snapToken, {
        onSuccess: () => {
          navigate(`/tracking/${pendingOrderInfo.orderCode}`);
        },
        onPending: () => {
          navigate(`/tracking/${pendingOrderInfo.orderCode}`);
        },
        onError: () => {
          setPaymentNotice({
            type: 'error',
            message: 'Pembayaran belum berhasil diselesaikan. Silakan coba kembali.',
          });
        },
        onClose: () => {
          setPaymentNotice({
            type: 'warning',
            message: 'Jendela pembayaran ditutup sebelum transaksi selesai.',
          });
        },
      });
    } catch (err: any) {
      setPaymentNotice({
        type: 'error',
        message: err?.message || 'Gagal memulai ulang pembayaran. Silakan cek status pesanan.',
      });
    } finally {
      setIsRetryingPayment(false);
    }
  };

  return (
    <div className="bg-[#f5f5f5] font-sans pb-36">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Top Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tambah Menu Lain</span>
          </Link>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1">
              <p className="font-bold">Gagal Membuat Pesanan</p>
              <p className="mt-0.5">{submitError}</p>
            </div>
          </div>
        )}

        {/* Payment Notice Banner */}
        {paymentNotice && (
          <div
            role="alert"
            className={`flex items-start gap-2.5 p-3.5 rounded-2xl border text-xs font-medium ${
              paymentNotice.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : paymentNotice.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            {paymentNotice.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            ) : paymentNotice.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
            )}
            <div className="flex-1">
              <p className="font-bold">
                {paymentNotice.type === 'error'
                  ? 'Perhatian Pembayaran'
                  : paymentNotice.type === 'warning'
                  ? 'Pembayaran Ditunda'
                  : 'Info Pembayaran'}
              </p>
              <p className="mt-0.5 leading-relaxed">{paymentNotice.message}</p>
            </div>
          </div>
        )}

        {/* Pending Order Quick Action (if popup was closed or order waiting) */}
        {pendingOrderInfo && (
          <div className="bg-brand-subtle/70 rounded-2xl border border-brand/50 p-4 space-y-3 shadow-subtle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-ink">
                  Pesanan Aktif: #{pendingOrderInfo.orderCode}
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-brand/30 px-2 py-0.5 rounded-md border border-brand/40">
                Menunggu Pembayaran
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Pesanan Anda telah dicatat. Klik <strong>Bayar Sekarang</strong> untuk menyelesaikan via Midtrans Snap, atau cek status pesanan.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handlePayPendingOrder}
                disabled={isRetryingPayment}
                className="flex-1 py-2.5 px-4 rounded-lg bg-ink text-surface text-xs font-bold flex items-center justify-center gap-2 hover:bg-ink/90 active:scale-98 transition-smooth disabled:opacity-50"
              >
                {isRetryingPayment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membuka Midtrans...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Bayar Sekarang</span>
                  </>
                )}
              </button>
              <Link
                to={`/tracking/${pendingOrderInfo.orderCode}`}
                className="py-2.5 px-4 rounded-lg bg-surface border border-border text-ink text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-surface-muted transition-smooth"
              >
                <span>Lihat Status Pesanan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Section 1: Pesananmu ───────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-subtle flex items-center justify-center text-base">
              🧾
            </div>
            <span className="text-sm font-bold text-ink">Pesananmu</span>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="text-3xl">🛒</div>
              <p className="text-sm font-semibold text-ink">Keranjang Kosong</p>
              <p className="text-xs text-ink-muted">Pilih menu terlebih dahulu.</p>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-lg bg-brand text-ink text-xs font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Lihat Katalog
              </Link>
            </div>
          ) : (
            <>
              {items.map((item, idx) => (
                <div key={item.cartItemId}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-ink leading-snug flex-1">
                        {item.menuItem.name}
                      </span>
                      <span className="text-sm font-bold text-ink whitespace-nowrap">
                        {formatIDR(item.subtotal)}
                      </span>
                    </div>

                    {item.spiceLevel !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-subtle border border-brand/30 text-[11px] font-semibold text-amber-800">
                        Level {item.spiceLevel}
                      </span>
                    )}

                    {item.notes && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-muted border border-border text-[11px] text-ink-muted">
                        <FileText className="w-3 h-3" />
                        {item.notes}
                      </span>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => removeItem(item.cartItemId)}
                        className="p-1.5 text-danger/70 hover:text-danger rounded-lg hover:bg-danger/5 transition-colors"
                        aria-label={`Hapus ${item.menuItem.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-ink hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-smooth"
                          aria-label="Kurangi"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-ink">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          disabled={item.quantity >= 50}
                          className="w-8 h-8 rounded-lg border-2 border-brand bg-brand flex items-center justify-center text-ink hover:bg-brand-hover disabled:opacity-30 disabled:cursor-not-allowed transition-smooth"
                          aria-label="Tambah"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {idx < items.length - 1 && <hr className="border-border mt-3" />}
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Section 2: Tipe Pesanan & Conditional Nomor Meja (1–10) ──── */}
        {items.length > 0 && (
          <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4" noValidate>
            <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
              <div>
                <p className="text-sm font-bold text-ink mb-2.5">Tipe pesanan</p>
                <div className="grid grid-cols-2 bg-surface-muted rounded-2xl border border-border p-1.5 gap-1.5">
                  {(
                    [
                      {
                        key: 'DINE_IN',
                        label: 'Dine-in',
                        sub: 'Makan di tempat',
                        icon: <UtensilsCrossed className="w-4 h-4" />,
                      },
                      {
                        key: 'TAKEAWAY',
                        label: 'Takeaway',
                        sub: 'Bawa pulang',
                        icon: <ShoppingBag className="w-4 h-4" />,
                      },
                    ] as { key: OrderType; label: string; sub: string; icon: React.ReactNode }[]
                  ).map(({ key, label, sub }) => {
                    const active = orderType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleOrderTypeChange(key)}
                        data-testid={`order-type-${key}`}
                        className={`py-2.5 px-3 rounded-lg text-center transition-smooth ${
                          active
                            ? 'bg-brand text-ink font-bold shadow-sm'
                            : 'text-ink-muted hover:bg-surface'
                        }`}
                      >
                        <span className="block text-sm font-bold">{label}</span>
                        <span
                          className={`block text-[11px] mt-0.5 ${
                            active ? 'text-ink/70' : 'text-ink-muted'
                          }`}
                        >
                          {sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Rendering: Nomor Meja (1–10) ONLY when DINE_IN */}
              {orderType === 'DINE_IN' && (
                <div className="space-y-2.5 pt-2 border-t border-border" data-testid="table-number-section">
                  <div className="flex items-center justify-between">
                    <label htmlFor="table-number" className="block text-xs font-semibold text-ink">
                      Nomor Meja (1–10) <span className="text-danger">*</span>
                    </label>
                  </div>


                  {/* Interactive Table Number Grid (1–10) */}
                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {VALID_TABLE_NUMBERS.map((num) => {
                      const isSelected = tableNumber === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleTableNumberChange(num)}
                          aria-label={`Pilih Meja ${num}`}
                          className={`py-2 rounded-lg text-xs font-bold border transition-smooth ${
                            isSelected
                              ? 'bg-brand border-brand text-ink shadow-sm'
                              : 'bg-surface-muted border-border text-ink-muted hover:text-ink hover:border-ink/30'
                          }`}
                        >
                          Meja {String(num).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>

                  {fieldErrors.tableNumber && (
                    <p className="text-xs text-danger font-medium">{fieldErrors.tableNumber}</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Section 3: Data Pemesan ───────────────────────────── */}
            <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-subtle flex items-center justify-center text-base">
                  🍴
                </div>
                <span className="text-sm font-bold text-ink">Data pemesan</span>
              </div>

              {/* Customer Name */}
              <div className="space-y-1.5">
                <label htmlFor="customer-name" className="block text-xs font-semibold text-ink">
                  Nama Pemesan <span className="text-danger">*</span>
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomerName(value);
                    saveCustomerSession(value, phoneNumber);
                    setFieldErrors((prev) => ({ ...prev, customerName: undefined }));
                  }}
                  placeholder="Contoh: Budi"
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-sm text-ink placeholder:text-ink-light focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-smooth"
                />
                {fieldErrors.customerName && (
                  <p className="text-xs text-danger font-medium">{fieldErrors.customerName}</p>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label htmlFor="customer-phone" className="block text-xs font-semibold text-ink">
                  Nomor WhatsApp / HP <span className="text-danger">*</span>
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 14);
                    setPhoneNumber(value);
                    saveCustomerSession(customerName, value);
                    setFieldErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                  }}
                  placeholder="081234567890"
                  maxLength={14}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-sm text-ink placeholder:text-ink-light focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-smooth"
                />
                {fieldErrors.phoneNumber && (
                  <p className="text-xs text-danger font-medium">{fieldErrors.phoneNumber}</p>
                )}
              </div>

              {/* Optional Order Notes */}
              <div className="space-y-1.5">
                <label htmlFor="order-notes" className="block text-xs font-semibold text-ink">
                  Catatan Tambahan <span className="text-ink-muted font-normal">(Opsional)</span>
                </label>
                <input
                  id="order-notes"
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value.slice(0, 255))}
                  placeholder="Contoh: Minta sendok plastik / sambal dipisah"
                  maxLength={255}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-sm text-ink placeholder:text-ink-light focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-smooth"
                />
              </div>
            </div>

            {/* ── Section 4: Ringkasan Pembayaran ─────────────────────── */}
            <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
              <p className="text-sm font-bold text-ink">Ringkasan pembayaran</p>

              <div className="flex items-center justify-between text-sm text-ink-muted">
                <span>Subtotal</span>
                <span className="font-semibold text-ink">{formatIDR(subtotalAmount)}</span>
              </div>

              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-ink">Total Pembayaran</span>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-ink block">
                    {formatIDR(subtotalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── Sticky Footer CTA ───────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-4 py-3 z-30">
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => handleCheckoutSubmit()}
              disabled={!validation.isValid || isSubmitting}
              data-testid="submit-checkout-button"
              className={`w-full py-3.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-smooth ${
                validation.isValid && !isSubmitting
                  ? 'bg-ink text-surface hover:bg-ink/90 active:scale-[0.98]'
                  : 'bg-surface-muted text-ink-muted border border-border cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyiapkan Pembayaran...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Bayar Sekarang</span>
                  {validation.isValid && <span className="text-base">→</span>}
                </>
              )}
            </button>
            {!validation.isValid && (
              <p className="text-center text-[10px] text-ink-muted mt-1.5">
                {orderType === 'DINE_IN' && tableNumber === null
                  ? 'Pilih nomor meja (1–10) serta lengkapi nama dan nomor HP untuk melanjutkan'
                  : 'Lengkapi nama dan nomor WhatsApp/HP untuk melanjutkan'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
