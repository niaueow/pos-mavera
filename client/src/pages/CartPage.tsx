import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  FileText,
  Lock,
  UtensilsCrossed,
  ShoppingBag,
} from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { formatIDR } from '../utils/currency';

type OrderType = 'DINE_IN' | 'TAKEAWAY';

export const CartPage: React.FC = () => {
  const { items, subtotalAmount, updateQuantity, removeItem } = useCart();
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Table number is pre-filled from QR Code scan (read-only in this phase)
  const tableNumber = 'Meja 05';

  const isFormValid =
    customerName.trim().length > 0 &&
    phoneNumber.trim().length >= 8;

  return (
    <div className="bg-[#f5f5f5] font-sans pb-32">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* ── Section 1: Pesananmu ───────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
          {/* Section header */}
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
                className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-xl bg-brand text-ink text-xs font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Lihat Katalog
              </Link>
            </div>
          ) : (
            <>
              {items.map((item, idx) => (
                <div key={item.cartItemId}>
                  {/* Item row */}
                  <div className="space-y-2">
                    {/* Name + Price */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-ink leading-snug flex-1">
                        {item.menuItem.name}
                      </span>
                      <span className="text-sm font-bold text-ink whitespace-nowrap">
                        {formatIDR(item.subtotal)}
                      </span>
                    </div>

                    {/* Level badge */}
                    {item.spiceLevel !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-subtle border border-brand/30 text-[11px] font-semibold text-amber-800">
                        Level {item.spiceLevel}
                      </span>
                    )}

                    {/* Notes badge */}
                    {item.notes && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-muted border border-border text-[11px] text-ink-muted">
                        <FileText className="w-3 h-3" />
                        {item.notes}
                      </span>
                    )}

                    {/* Delete + Qty controls */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <button
                        onClick={() => removeItem(item.cartItemId)}
                        className="p-1.5 text-danger/70 hover:text-danger rounded-lg hover:bg-danger/5 transition-colors"
                        aria-label={`Hapus ${item.menuItem.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Qty stepper */}
                      <div className="flex items-center gap-3">
                        <button
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

                  {/* Divider between items */}
                  {idx < items.length - 1 && <hr className="border-border mt-3" />}
                </div>
              ))}

            </>
          )}
        </div>

        {/* ── Section 2: Tipe Pesanan ────────────────────────────────── */}
        {items.length > 0 && (
          <>
            <div>
              <p className="text-sm font-bold text-ink mb-2">Tipe pesanan</p>
              <div className="grid grid-cols-2 bg-surface rounded-2xl border border-border p-1.5 gap-1.5">
                {(
                  [
                    { key: 'DINE_IN', label: 'Dine-in', sub: 'Makan di tempat', icon: <UtensilsCrossed className="w-4 h-4" /> },
                    { key: 'TAKEAWAY', label: 'Takeaway', sub: 'Bawa pulang', icon: <ShoppingBag className="w-4 h-4" /> },
                  ] as { key: OrderType; label: string; sub: string; icon: React.ReactNode }[]
                ).map(({ key, label, sub }) => {
                  const active = orderType === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setOrderType(key)}
                      className={`py-2.5 px-3 rounded-xl text-center transition-smooth ${active
                        ? 'bg-brand text-ink font-bold shadow-sm'
                        : 'text-ink-muted hover:bg-surface-muted'
                        }`}
                    >
                      <span className="block text-sm font-bold">{label}</span>
                      <span className={`block text-[11px] mt-0.5 ${active ? 'text-ink/70' : 'text-ink-muted'}`}>
                        {sub}
                      </span>
                    </button>
                  );
                })}
              </div>
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
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Budi"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-sm text-ink placeholder:text-ink-light focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-smooth"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label htmlFor="customer-phone" className="block text-xs font-semibold text-ink">
                  Nomor WhatsApp / HP <span className="text-danger">*</span>
                </label>
                <div className="flex">
                  <span className="flex items-center px-3 border border-r-0 border-border rounded-l-xl bg-surface-muted text-sm font-semibold text-ink-muted select-none">
                    +62
                  </span>
                  <input
                    id="customer-phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="812 3456 7890"
                    className="flex-1 px-3.5 py-2.5 rounded-r-xl bg-surface border border-border text-sm text-ink placeholder:text-ink-light focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-smooth"
                  />
                </div>
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
                  <span className="text-[10px] text-ink-muted">Harga sudah final, tanpa biaya tambahan.</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Sticky Footer CTA ───────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-4 py-3 z-20">
          <div className="max-w-lg mx-auto">
            <button
              disabled={!isFormValid}
              className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-smooth ${isFormValid
                ? 'bg-ink text-surface hover:bg-ink/90 active:scale-[0.98]'
                : 'bg-surface-muted text-ink-muted border border-border cursor-not-allowed'
                }`}
            >
              <span>Lanjut ke Pembayaran</span>
              {isFormValid && <span className="text-base">→</span>}
            </button>
            {!isFormValid && (
              <p className="text-center text-[10px] text-ink-muted mt-1.5">
                Lengkapi data wajib untuk melanjutkan
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
