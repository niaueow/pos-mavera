import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getActiveOrders, updateOrderStatus, ActiveOrder } from '../services/internalOrderService';
import { ApiClientError } from '../services/apiClient';
import { formatIDR } from '../utils/currency';
import {
  LogOut,
  UtensilsCrossed,
  Clock,
  ChefHat,
  CheckCircle,
  RefreshCw,
  Flame,
  FileText,
  ArrowRight,
  AlertCircle,
  Loader,
} from 'lucide-react';

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; nextStatus: string | null; nextLabel: string | null }
> = {
  RECEIVED: {
    label: 'Diterima',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    nextStatus: 'PREPARING',
    nextLabel: 'Proses Masakan',
  },
  PREPARING: {
    label: 'Sedang Dimasak',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    nextStatus: 'READY',
    nextLabel: 'Siap Diambil',
  },
  READY: {
    label: 'Siap Diambil',
    color: 'text-success bg-success-surface border-success/30',
    nextStatus: 'COMPLETED',
    nextLabel: 'Tandai Selesai',
  },
  COMPLETED: {
    label: 'Selesai',
    color: 'text-ink-muted bg-surface-muted border-border',
    nextStatus: null,
    nextLabel: null,
  },
};

type ConfirmDialogState = {
  isOpen: boolean;
  order: ActiveOrder | null;
  nextStatus: string | null;
};


export const StaffDashboardPage: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    order: null,
    nextStatus: null,
  });

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await getActiveOrders(token);
      setOrders(res.data);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 401) {
        logout();
        navigate('/staff/login', { replace: true });
        return;
      }
      setError('Gagal memuat pesanan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [token, logout, navigate]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleLogout = () => {
    logout();
    navigate('/staff/login', { replace: true });
  };

  const promptTransition = (order: ActiveOrder, nextStatus: string) => {
    setConfirmDialog({ isOpen: true, order, nextStatus });
  };

  const confirmTransition = async () => {
    const { order, nextStatus } = confirmDialog;
    if (!order || !nextStatus || !token) return;

    setConfirmDialog({ isOpen: false, order: null, nextStatus: null });
    setUpdatingOrderId(order.id);

    try {
      await updateOrderStatus(token, order.id, nextStatus);
      await loadOrders(); // Refresh after update
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`Gagal memperbarui status: ${err.message}`);
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = orders.filter(
    (o) => activeFilter === 'ALL' || o.order_status === activeFilter
  );

  const countByStatus = (status: string) =>
    orders.filter((o) => o.order_status === status).length;

  const filterTabs = [
    { key: 'ALL', label: 'Semua', count: orders.length, icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
    { key: 'RECEIVED', label: 'Diterima', count: countByStatus('RECEIVED'), icon: <Clock className="w-3.5 h-3.5" /> },
    { key: 'PREPARING', label: 'Sedang Dimasak', count: countByStatus('PREPARING'), icon: <ChefHat className="w-3.5 h-3.5" /> },
    { key: 'READY', label: 'Siap Diambil', count: countByStatus('READY'), icon: <CheckCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-surface-muted font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface border-b border-border shadow-subtle px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-ink font-bold text-xs">
            MG
          </div>
          <div>
            <span className="text-sm font-bold text-ink">Pesanan Masuk</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Live
          </span>

          {/* Refresh */}
          <button
            onClick={loadOrders}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition-smooth"
            aria-label="Refresh pesanan"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* User info + logout */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-ink leading-tight">{user?.name}</p>
              <p className="text-[10px] text-ink-muted capitalize">{user?.role}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-ink text-surface text-xs font-bold flex items-center justify-center">
              {user?.name?.substring(0, 2).toUpperCase() || 'MV'}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-ink-muted hover:text-danger transition-colors p-1 rounded"
              aria-label="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap mb-5 bg-surface p-1.5 rounded-xl border border-border shadow-subtle">
          {filterTabs.map(({ key, label, count, icon }) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-smooth ${
                  isActive
                    ? 'bg-brand text-ink shadow-sm font-bold'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-muted'
                }`}
              >
                {icon}
                <span>{label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    isActive ? 'bg-ink/10' : 'bg-surface-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-danger-surface border border-danger/20 mb-4 text-sm text-danger font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">Tutup</button>
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-ink-muted">
            <Loader className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">Memuat pesanan...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-16 h-16 rounded-full bg-brand-subtle flex items-center justify-center text-3xl mx-auto">
              🎉
            </div>
            <h3 className="text-base font-bold text-ink">Tidak Ada Pesanan Aktif</h3>
            <p className="text-sm text-ink-muted">
              {activeFilter === 'ALL'
                ? 'Belum ada pesanan yang masuk saat ini.'
                : `Tidak ada pesanan dengan status "${ORDER_STATUS_CONFIG[activeFilter]?.label}".`}
            </p>
          </div>
        ) : (
          /* Order grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => {
              const statusConfig = ORDER_STATUS_CONFIG[order.order_status] || ORDER_STATUS_CONFIG.RECEIVED;
              const isUpdating = updatingOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-surface rounded-xl border border-border shadow-subtle flex flex-col"
                >
                  {/* Card Header */}
                  <div className="p-3.5 border-b border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-ink">{order.order_code}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-ink-muted font-medium">
                          {order.order_type === 'DINE_IN'
                            ? `Meja ${order.table_number}`
                            : 'Takeaway'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                      <span className="text-[10px] text-success font-bold">PAID</span>
                    </div>
                  </div>

                  {/* Customer + Items */}
                  <div className="p-3.5 flex-1 space-y-2.5">
                    <div>
                      <p className="text-xs font-bold text-ink">{order.customer_name}</p>
                      <p className="text-[10px] text-ink-muted">{order.order_type === 'DINE_IN' ? 'Dine-in' : 'Takeaway'}</p>
                    </div>

                    <div className="space-y-1.5">
                      {order.items.map((item) => (
                        <div key={item.id} className="text-xs">
                          <div className="flex items-start gap-1.5">
                            <span className="font-bold text-ink shrink-0">{item.quantity}×</span>
                            <span className="text-ink line-clamp-1">{item.menu_name}</span>
                          </div>
                          {(item.spice_level !== null || item.notes) && (
                            <div className="flex gap-1.5 mt-0.5 ml-5 flex-wrap">
                              {item.spice_level !== null && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                                  <Flame className="w-2.5 h-2.5 text-red-500 fill-red-500" />
                                  Level {item.spice_level}
                                </span>
                              )}
                              {item.notes && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-muted text-ink-muted text-[10px] border border-border">
                                  <FileText className="w-2.5 h-2.5" />
                                  {item.notes}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-3.5 border-t border-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-ink-muted">Total</span>
                      <span className="block text-sm font-extrabold text-ink">
                        {formatIDR(order.total_amount)}
                      </span>
                    </div>

                    {statusConfig.nextStatus && (
                      <button
                        onClick={() => promptTransition(order, statusConfig.nextStatus!)}
                        disabled={isUpdating}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-smooth active:scale-95 ${
                          order.order_status === 'READY'
                            ? 'bg-success text-white hover:bg-success/90'
                            : 'bg-brand hover:bg-brand-hover text-ink'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isUpdating ? (
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                        <span>{statusConfig.nextLabel}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && confirmDialog.order && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-modal p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-brand-subtle flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6 text-brand-hover" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink mb-1">
                {confirmDialog.nextStatus === 'COMPLETED'
                  ? 'Tandai pesanan selesai?'
                  : `Lanjut ke tahap berikutnya?`}
              </h3>
              <p className="text-xs text-ink-muted">
                {confirmDialog.order.order_code} akan dipindahkan ke{' '}
                <strong>{ORDER_STATUS_CONFIG[confirmDialog.nextStatus!]?.label}</strong>.
                {confirmDialog.nextStatus === 'COMPLETED' &&
                  ' Pesanan tidak akan muncul lagi di dashboard aktif.'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, order: null, nextStatus: null })}
                className="flex-1 py-2.5 rounded-xl border border-border text-ink text-sm font-semibold hover:bg-surface-muted transition-smooth"
              >
                Batal
              </button>
              <button
                onClick={confirmTransition}
                className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-ink text-sm font-bold shadow-sm transition-smooth"
              >
                {confirmDialog.nextStatus === 'COMPLETED' ? 'Ya, Tandai Selesai' : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
