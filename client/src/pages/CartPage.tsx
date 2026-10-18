import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Minus, Flame, FileText, AlertCircle } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { formatIDR } from '../utils/currency';

export const CartPage: React.FC = () => {
  const { items, totalCount, subtotalAmount, updateQuantity, removeItem, clearCart } = useCart();

  return (
    <div className="pb-24 pt-4 sm:pt-6">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Navigation back */}
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Katalog Menu</span>
          </Link>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-danger hover:underline font-semibold"
            >
              Kosongkan Keranjang
            </button>
          )}
        </div>

        <div className="bg-surface rounded-2xl border border-border shadow-subtle p-4 sm:p-6">
          <h2 className="text-lg font-bold text-ink mb-4 pb-3 border-b border-border flex items-center justify-between">
            <span>Rincian Keranjang</span>
            <span className="text-xs font-semibold text-ink-muted bg-surface-muted px-2.5 py-1 rounded-md border border-border">
              {totalCount} item
            </span>
          </h2>

          {items.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-full bg-brand-subtle flex items-center justify-center text-3xl mx-auto">
                🛒
              </div>
              <h3 className="text-base font-bold text-ink">Keranjang Anda Kosong</h3>
              <p className="text-xs sm:text-sm text-ink-muted max-w-sm mx-auto">
                Belum ada pesanan yang dipilih. Kembali ke katalog untuk memilih ayam geprek favorit Anda!
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 rounded-xl bg-brand text-ink font-bold text-xs sm:text-sm shadow-sm hover:bg-brand-hover transition-smooth"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Lihat Katalog Menu</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.cartItemId}
                  className="bg-surface-muted rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-brand-subtle px-1.5 py-0.5 rounded">
                      {item.menuItem.category}
                    </span>
                    <h4 className="text-sm sm:text-base font-bold text-ink mt-1">
                      {item.menuItem.name}
                    </h4>
                    <span className="text-xs font-semibold text-ink-muted">
                      {formatIDR(item.unitPrice)}
                    </span>

                    {(item.spiceLevel !== undefined || item.notes) && (
                      <div className="flex flex-wrap gap-1.5 text-xs mt-2 pt-2 border-t border-border/60">
                        {item.spiceLevel !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                            <Flame className="w-3 h-3 text-red-500 fill-red-500" />
                            <span>Level {item.spiceLevel}</span>
                          </span>
                        )}
                        {item.notes && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface text-ink-muted border border-border">
                            <FileText className="w-3 h-3 text-ink-light" />
                            <span>{item.notes}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/80">
                    <div className="flex items-center gap-2 bg-surface rounded-lg border border-border px-2 py-1">
                      <button
                        onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                        className="p-1 text-ink hover:text-amber-700 active:scale-95 transition-transform"
                        aria-label="Kurangi"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-ink">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                        className="p-1 text-ink hover:text-amber-700 active:scale-95 transition-transform"
                        aria-label="Tambah"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <span className="text-sm font-extrabold text-ink block">
                        {formatIDR(item.subtotal)}
                      </span>
                    </div>

                    <button
                      onClick={() => removeItem(item.cartItemId)}
                      className="p-1.5 text-ink-light hover:text-danger rounded hover:bg-surface transition-colors"
                      aria-label="Hapus item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Price estimation notice */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-muted text-ink-muted text-xs border border-border mt-4">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Total merupakan estimasi katalog. Harga final dihitung ulang otomatis oleh server saat order dibuat.
                </span>
              </div>

              {/* Total & Action */}
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-ink-muted">Estimasi Total</span>
                  <span className="block text-xl font-extrabold text-ink">
                    {formatIDR(subtotalAmount)}
                  </span>
                </div>

                <button
                  disabled
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand/40 text-ink/60 font-bold text-sm cursor-not-allowed border border-brand/30 flex items-center justify-center gap-2"
                  title="Checkout akan aktif di Milestone 4"
                >
                  <span>Lanjut ke Checkout</span>
                  <span className="text-[10px] font-normal uppercase px-1.5 py-0.5 bg-surface rounded text-ink-muted">
                    Fase 1B
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
