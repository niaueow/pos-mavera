import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getActiveOrders,
  getOrderById,
  updateOrderStatus,
  ActiveOrder,
  ORDER_STATUS_CONFIG,
  getOrderStatusMeta,
  formatTableLabel,
  formatRelativeMinutes,
} from '../services/internalOrderService';
import { ApiClientError } from '../services/apiClient';
import { formatIDR } from '../utils/currency';
import {
  LogOut,
  Check,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Loader,
  Receipt,
  SlidersHorizontal,
  History,
  BarChart3,
  X,
  Phone,
  User as UserIcon,
  Clock,
  FileText,
  ChevronDown,
} from 'lucide-react';

type ConfirmDialogState = {
  isOpen: boolean;
  order: ActiveOrder | null;
  nextStatus: string | null;
};

function formatIndonesianDateTime(date: Date): string {
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dayName}, ${dayNum} ${monthName} ${year} · ${hours}.${minutes}`;
}

export const StaffDashboardPage: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Detail modal state (integrates with GET /api/v1/staff/orders/:id)
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Confirmation modal state for completing an order (matches Confirm order.png)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    order: null,
    nextStatus: null,
  });

  // Update clock every 30s
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadOrders = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setIsRefreshing(true);
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
        setError('Gagal memuat daftar pesanan aktif. Silakan muat ulang.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, logout, navigate]
  );

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders(true), 15000); // Auto-refresh every 15s
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleLogout = () => {
    logout();
    navigate('/staff/login', { replace: true });
  };

  /**
   * Opens the Order Detail Modal and fetches complete order detail + status_logs from GET /api/v1/staff/orders/:id
   */
  const handleOpenOrderDetail = async (order: ActiveOrder) => {
    setSelectedOrder(order);
    if (!token) return;
    setIsLoadingDetail(true);
    try {
      const res = await getOrderById(token, order.id);
      setSelectedOrder(res.data);
    } catch {
      // Keep the already selected summary order if detail fetch fails
    } finally {
      setIsLoadingDetail(false);
    }
  };

  /**
   * Executes status transition via PATCH /api/v1/staff/orders/:id/status
   * and immediately refreshes local state + active orders list.
   */
  const executeStatusTransition = async (order: ActiveOrder, nextStatus: string) => {
    if (!token) return;
    setUpdatingOrderId(order.id);
    setError(null);

    try {
      await updateOrderStatus(token, order.id, nextStatus);

      // Optimistic state update for immediate UI responsiveness
      setOrders((prev) =>
        nextStatus === 'COMPLETED'
          ? prev.filter((item) => item.id !== order.id)
          : prev.map((item) =>
              item.id === order.id ? { ...item, order_status: nextStatus } : item
            )
      );

      // Update detail modal if open for this order
      if (selectedOrder && selectedOrder.id === order.id) {
        if (nextStatus === 'COMPLETED') {
          setSelectedOrder(null);
        } else {
          const refreshedDetail = await getOrderById(token, order.id).catch(() => null);
          if (refreshedDetail) {
            setSelectedOrder(refreshedDetail.data);
          } else {
            setSelectedOrder({ ...selectedOrder, order_status: nextStatus });
          }
        }
      }

      // Sync authoritative list from backend
      await loadOrders(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`Gagal memperbarui status: ${err.message}`);
      } else {
        setError('Terjadi kesalahan saat memperbarui status pesanan.');
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  /**
   * Handles dynamic action button click:
   * - RECEIVED -> PREPARING ("Proses Makanan") & PREPARING -> READY ("Siap Diambil") execute immediately for fast kitchen flow.
   * - READY -> COMPLETED ("Tandai Selesai") opens the confirmation modal per Confirm order.png.
   */
  const handleStatusButtonClick = (
    e: React.MouseEvent,
    order: ActiveOrder,
    nextStatus: string
  ) => {
    e.stopPropagation();
    if (nextStatus === 'COMPLETED') {
      setConfirmDialog({ isOpen: true, order, nextStatus });
    } else {
      executeStatusTransition(order, nextStatus);
    }
  };

  const confirmCompleteOrder = async () => {
    const { order, nextStatus } = confirmDialog;
    if (!order || !nextStatus) return;
    setConfirmDialog({ isOpen: false, order: null, nextStatus: null });
    await executeStatusTransition(order, nextStatus);
  };

  const countByStatus = (status: string) =>
    orders.filter((o) => o.order_status === status).length;

  const filterTabs = [
    { key: 'ALL', label: 'Semua', count: orders.length },
    { key: 'RECEIVED', label: 'Diterima', count: countByStatus('RECEIVED') },
    { key: 'PREPARING', label: 'Sedang Dimasak', count: countByStatus('PREPARING') },
    { key: 'READY', label: 'Siap Diambil', count: countByStatus('READY') },
  ];

  const filteredOrders = orders.filter(
    (o) => activeFilter === 'ALL' || o.order_status === activeFilter
  );

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'MV';

  const roleDisplay =
    user?.role === 'OWNER'
      ? 'Owner'
      : user?.role === 'ADMIN'
        ? 'Admin'
        : 'Kasir / Dapur';

  const renderOrderCard = (order: ActiveOrder) => {
    const statusMeta = getOrderStatusMeta(order.order_status);
    const isUpdating = updatingOrderId === order.id;
    const tableLabel = formatTableLabel(order.order_type, order.table_number);
    const relativeTime = formatRelativeMinutes(order.created_at, currentTime.getTime());
    const isNewOrder = order.order_status === 'RECEIVED' && relativeTime.minutes <= 10;

    return (
      <div
        key={order.id}
        onClick={() => handleOpenOrderDetail(order)}
        role="article"
        aria-label={`Pesanan ${order.order_code}`}
        className="relative bg-surface rounded-2xl border border-border p-4 shadow-subtle hover:shadow-card transition-smooth flex flex-col cursor-pointer"
      >
        {/* BARU Badge for newly received orders */}
        {isNewOrder && (
          <span className="absolute -top-2.5 right-4 bg-brand text-ink text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-subtle uppercase tracking-wider">
            BARU
          </span>
        )}

        {/* Row 1: Order Code + Table/Type Pill + Elapsed Time */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-sm font-extrabold text-ink tracking-tight">
            {order.order_code}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-surface-muted border border-border text-[11px] font-bold text-ink">
              {tableLabel}
            </span>
            <span className={`text-[11px] ${relativeTime.urgencyClass}`}>
              {relativeTime.text}
            </span>
          </div>
        </div>

        {/* Row 2: Customer Name + Order Type text + PAID badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-xs font-extrabold text-ink truncate">
              {order.customer_name}
            </span>
            <span className="text-xs text-ink-muted shrink-0">
              {order.order_type === 'DINE_IN' ? 'Dine-in' : 'Takeaway'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-[#E3F7EC] text-[#007A4C] text-[10px] font-extrabold uppercase tracking-wide">
            {order.payment_status || 'PAID'}
          </span>
        </div>

        {/* Row 3: Order Items Summary Box */}
        <div className="bg-[#F7F6F2] rounded-xl p-3 space-y-2 mb-3 flex-1">
          {order.items.map((item) => (
            <div key={item.id} className="text-xs">
              <div className="flex items-start gap-1.5">
                <span className="font-extrabold text-ink shrink-0">
                  {item.quantity}x
                </span>
                <span className="text-ink font-medium leading-snug">
                  {item.menu_name || item.name}
                </span>
              </div>
              {(item.spice_level !== null && item.spice_level !== undefined) || item.notes ? (
                <div className="flex items-center gap-2 mt-1 ml-5 flex-wrap">
                  {item.spice_level !== null && item.spice_level !== undefined && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FFF3C4] text-[#7A5800] text-[10px] font-bold">
                      Level {item.spice_level}
                    </span>
                  )}
                  {item.notes && (
                    <span className="text-[11px] text-danger italic font-semibold">
                      &ldquo;{item.notes}&rdquo;
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Row 4: Total Amount */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <span className="text-xs text-ink-muted font-medium">Total</span>
          <span className="text-sm font-extrabold text-ink">
            {formatIDR(order.total_amount)}
          </span>
        </div>

        {/* Row 5: Dynamic Status Transition Button */}
        {statusMeta.nextStatus && statusMeta.nextLabel && (
          <button
            type="button"
            onClick={(e) => handleStatusButtonClick(e, order, statusMeta.nextStatus!)}
            disabled={isUpdating}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-between transition-smooth active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${statusMeta.buttonClass}`}
          >
            <span>{statusMeta.nextLabel}</span>
            {isUpdating ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    );
  };

  const kanbanColumns: { key: 'RECEIVED' | 'PREPARING' | 'READY'; title: string }[] = [
    { key: 'RECEIVED', title: 'Diterima' },
    { key: 'PREPARING', title: 'Sedang Dimasak' },
    { key: 'READY', title: 'Siap Diambil' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex font-sans text-ink">
      {/* ── Left Sidebar (matches dashboard order all.png) ────────────── */}
      <aside className="hidden md:flex md:w-60 lg:w-64 bg-surface border-r border-border flex-col justify-between shrink-0 select-none">
        <div className="p-4 space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-ink font-extrabold text-sm">
              MG
            </div>
            <div className="leading-tight">
              <span className="block text-base font-extrabold text-ink">Mavera</span>
              <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                ADMIN
              </span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl bg-[#FFF6D6] text-ink font-bold text-sm transition-smooth"
            >
              <span className="flex items-center gap-3">
                <Receipt className="w-4 h-4 text-ink" />
                <span>Pesanan</span>
              </span>
              <span className="w-6 h-6 rounded-full bg-brand text-ink text-xs font-extrabold flex items-center justify-center">
                {orders.length}
              </span>
            </button>

            <div
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-ink-muted text-sm font-medium opacity-70 cursor-default"
              title="Tersedia pada Tahap 2 (Admin Dashboard)"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Kelola Menu</span>
            </div>

            <div
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-ink-muted text-sm font-medium opacity-70 cursor-default"
              title="Tersedia pada Tahap 2 (Admin Dashboard)"
            >
              <History className="w-4 h-4" />
              <span>Riwayat</span>
            </div>

            <div
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-ink-muted text-sm font-medium opacity-70 cursor-default"
              title="Tersedia pada Tahap 2 (Owner Dashboard)"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Laporan</span>
            </div>
          </nav>
        </div>

        {/* Bottom User Profile & Logout */}
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-surface-muted border border-border/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-brand text-ink font-extrabold text-xs flex items-center justify-center shrink-0">
                {userInitials}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-xs font-bold text-ink truncate">
                  {user?.name || 'Staf Mavera'}
                </p>
                <p className="text-[11px] text-ink-muted truncate">{roleDisplay}</p>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0" />
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-ink-muted hover:text-danger hover:bg-danger-surface/50 transition-smooth"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-surface border-b border-border px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="md:hidden w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-ink font-extrabold text-xs">
              MG
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-ink">Pesanan Masuk</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden sm:inline-block text-xs text-ink-muted font-medium">
              {formatIndonesianDateTime(currentTime)}
            </span>

            {/* Live Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E3F7EC] text-[#007A4C] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#007A4C] animate-pulse" />
              Live
            </span>

            {/* Mobile Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="md:hidden p-2 rounded-lg text-ink-muted hover:text-danger transition-colors"
              aria-label="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-[1400px] w-full mx-auto">
          {/* Filter Bar Card */}
          <div className="bg-surface rounded-2xl border border-border p-2 flex flex-wrap items-center justify-between gap-2 shadow-subtle">
            <div className="flex items-center gap-1.5 flex-wrap" role="tablist">
              {filterTabs.map(({ key, label, count }) => {
                const isActive = activeFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveFilter(key)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-smooth ${
                      isActive
                        ? 'bg-brand text-ink font-extrabold shadow-subtle'
                        : 'bg-[#F4F3EF] text-ink font-semibold hover:bg-border/50'
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center ${
                        isActive
                          ? 'bg-ink/15 text-ink'
                          : 'bg-ink/10 text-ink-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => loadOrders()}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-muted transition-smooth ml-auto"
              aria-label="Refresh Status API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-ink' : ''}`} />
              <span>Status API</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-danger-surface border border-danger/20 text-xs sm:text-sm text-danger font-semibold"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-auto text-xs underline"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Main Order Board */}
          {isLoading ? (
            <div className="flex items-center justify-center py-24 gap-3 text-ink-muted">
              <Loader className="w-6 h-6 animate-spin" />
              <span className="text-sm font-medium">Memuat pesanan aktif...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-brand-subtle flex items-center justify-center text-2xl mx-auto">
                🍽️
              </div>
              <h2 className="text-base font-extrabold text-ink">
                Belum Ada Pesanan Aktif
              </h2>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                Pesanan yang sudah dibayar akan otomatis tampil di sini secara real-time.
              </p>
            </div>
          ) : activeFilter === 'ALL' ? (
            /* ── 3-Column Kanban View (matches dashboard order all.png) ── */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {kanbanColumns.map((col) => {
                const colOrders = orders.filter((o) => o.order_status === col.key);
                const colMeta = getOrderStatusMeta(col.key);

                return (
                  <section
                    key={col.key}
                    aria-label={`Kolom ${col.title}`}
                    className="bg-[#F3F2EE] rounded-2xl p-3.5 space-y-3.5 border border-border/60"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between px-1">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold ${colMeta.columnPillClass}`}
                      >
                        {col.title}
                      </span>
                      <span className="w-6 h-6 rounded-full bg-surface border border-border text-xs font-extrabold text-ink flex items-center justify-center shadow-subtle">
                        {colOrders.length}
                      </span>
                    </div>

                    {/* Column Cards */}
                    {colOrders.length === 0 ? (
                      <div className="bg-surface/60 rounded-2xl border border-dashed border-border p-8 text-center">
                        <p className="text-xs text-ink-muted font-medium">
                          Tidak ada pesanan di tahap {col.title.toLowerCase()}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {colOrders.map((order) => renderOrderCard(order))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            /* ── Filtered Grid View (matches order filtered.png) ──────── */
            <div className="bg-[#F3F2EE] rounded-2xl p-4 border border-border/60">
              {filteredOrders.length === 0 ? (
                <div className="bg-surface rounded-2xl p-12 text-center">
                  <p className="text-sm font-bold text-ink">
                    Tidak ada pesanan dengan status &ldquo;
                    {ORDER_STATUS_CONFIG[activeFilter]?.label}&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredOrders.map((order) => renderOrderCard(order))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Order Detail Modal (GET /api/v1/staff/orders/:id) ─────────── */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-order-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl border border-border shadow-modal max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="detail-order-title" className="text-base font-extrabold text-ink">
                    {selectedOrder.order_code}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      getOrderStatusMeta(selectedOrder.order_status).badgeClass
                    }`}
                  >
                    {getOrderStatusMeta(selectedOrder.order_status).label}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#E3F7EC] text-[#007A4C] text-[10px] font-extrabold">
                    {selectedOrder.payment_status || 'PAID'}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-1">
                  Detail Pesanan Pelanggan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
                aria-label="Tutup detail pesanan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Customer & Table Info */}
              <div className="grid grid-cols-2 gap-3 bg-surface-muted rounded-xl p-3.5 border border-border/60 text-xs">
                <div className="space-y-1">
                  <span className="text-ink-muted flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5" /> Pemesan
                  </span>
                  <p className="font-bold text-ink text-sm">{selectedOrder.customer_name}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-ink-muted flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> No. Telepon
                  </span>
                  <p className="font-bold text-ink text-sm">{selectedOrder.customer_phone}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-ink-muted">Tipe Pesanan</span>
                  <p className="font-bold text-ink">
                    {selectedOrder.order_type === 'DINE_IN' ? 'Dine-in (Makan di Tempat)' : 'Takeaway (Bawa Pulang)'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-ink-muted">Nomor Meja</span>
                  <p className="font-bold text-ink">
                    {formatTableLabel(selectedOrder.order_type, selectedOrder.table_number)}
                  </p>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="p-3 rounded-xl bg-brand-subtle/60 border border-brand/30 text-xs">
                  <span className="font-bold text-ink block mb-0.5">Catatan Pesanan:</span>
                  <span className="text-ink-muted">{selectedOrder.notes}</span>
                </div>
              )}

              {/* Order Items Detail */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">
                    Rincian Menu ({selectedOrder.items.length} Item)
                  </h3>
                  {isLoadingDetail && (
                    <span className="text-[11px] text-ink-muted flex items-center gap-1">
                      <Loader className="w-3 h-3 animate-spin" /> Memuat...
                    </span>
                  )}
                </div>

                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="p-3 bg-surface flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-ink">
                            {item.quantity}x
                          </span>
                          <span className="text-xs font-bold text-ink">
                            {item.menu_name || item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap pl-5">
                          {item.spice_level !== null && item.spice_level !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-[#FFF3C4] text-[#7A5800] text-[10px] font-bold">
                              Level {item.spice_level}
                            </span>
                          )}
                          {item.notes && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-danger italic font-semibold">
                              <FileText className="w-3 h-3" />
                              &ldquo;{item.notes}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-ink whitespace-nowrap">
                        {formatIDR(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status History Logs if loaded */}
              {selectedOrder.status_logs && selectedOrder.status_logs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Riwayat Status
                  </h3>
                  <div className="bg-surface-muted rounded-xl p-3 space-y-2 border border-border/60">
                    {selectedOrder.status_logs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-ink">
                          {getOrderStatusMeta(log.new_status).label}
                          <span className="text-ink-muted font-normal"> oleh {log.changed_by}</span>
                        </span>
                        <span className="text-ink-muted">
                          {new Date(log.created_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Total & Dynamic Action Button */}
            <div className="p-4 sm:p-5 border-t border-border bg-surface flex items-center justify-between gap-4">
              <div>
                <span className="block text-[11px] text-ink-muted">Total Harga</span>
                <span className="text-base font-extrabold text-ink">
                  {formatIDR(selectedOrder.total_amount)}
                </span>
              </div>

              {getOrderStatusMeta(selectedOrder.order_status).nextStatus && (
                <button
                  type="button"
                  onClick={(e) =>
                    handleStatusButtonClick(
                      e,
                      selectedOrder,
                      getOrderStatusMeta(selectedOrder.order_status).nextStatus!
                    )
                  }
                  disabled={updatingOrderId === selectedOrder.id}
                  className={`py-2.5 px-5 rounded-xl text-xs font-bold flex items-center gap-2 transition-smooth ${
                    getOrderStatusMeta(selectedOrder.order_status).buttonClass
                  } disabled:opacity-50`}
                >
                  <span>{getOrderStatusMeta(selectedOrder.order_status).nextLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Complete Order Confirmation Modal (matches Confirm order.png) ── */}
      {confirmDialog.isOpen && confirmDialog.order && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="bg-surface rounded-2xl border border-border shadow-modal p-6 max-w-sm w-full text-center space-y-5"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#FFF6D6] flex items-center justify-center mx-auto">
              <Check className="w-5 h-5 text-ink stroke-[2.5]" />
            </div>

            <div className="space-y-1.5">
              <h3 id="confirm-dialog-title" className="text-base font-extrabold text-ink">
                Tandai pesanan selesai?
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                {confirmDialog.order.order_code} akan dipindahkan ke Riwayat dan tidak muncul
                lagi di dashboard aktif.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setConfirmDialog({ isOpen: false, order: null, nextStatus: null })
                }
                className="flex-1 py-2.5 rounded-xl border border-border text-ink text-xs font-bold hover:bg-surface-muted transition-smooth"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmCompleteOrder}
                className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-ink text-xs font-extrabold transition-smooth"
              >
                Ya, Tandai Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
