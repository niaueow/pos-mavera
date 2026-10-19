import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Plus, Minus, ShoppingBag, FileText, AlertCircle, ArrowLeft } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { formatIDR } from '../utils/currency';

export const CartDrawer: React.FC = () => {
  const navigate = useNavigate();
  const {
    items,
    totalCount,
    subtotalAmount,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/50 backdrop-blur-sm flex justify-end">
      {/* Drawer Overlay Backdrop */}
      <div
        className="w-full max-w-md bg-surface h-full flex flex-col border-l border-border shadow-modal animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-ink" />
            <h2 id="cart-title" className="text-base font-bold text-ink">
              Keranjang Pesanan ({totalCount})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-danger hover:underline px-2 py-1 rounded"
              >
                Kosongkan
              </button>
            )}
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
              aria-label="Tutup keranjang"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-brand-subtle flex items-center justify-center text-ink text-2xl">
                🛒
              </div>
              <h3 className="text-base font-bold text-ink">Keranjang Anda Kosong</h3>
              <p className="text-xs text-ink-muted max-w-xs">
                Belum ada menu yang dipilih. Silakan jelajahi menu Ayam Geprek Mavera favoritmu!
              </p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-ink font-bold text-xs shadow-sm hover:bg-brand-hover transition-smooth"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Pilih Menu Sekarang</span>
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.cartItemId}
                className="bg-surface-muted rounded-xl border border-border p-3.5 flex flex-col gap-2.5 transition-smooth"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-brand-subtle px-1.5 py-0.5 rounded">
                      {item.menuItem.category}
                    </span>
                    <h4 className="text-sm font-bold text-ink leading-snug mt-1">
                      {item.menuItem.name}
                    </h4>
                    <span className="text-xs font-semibold text-ink-muted">
                      {formatIDR(item.unitPrice)}
                    </span>
                  </div>

                  <button
                    onClick={() => removeItem(item.cartItemId)}
                    className="p-1 text-ink-light hover:text-danger rounded hover:bg-surface transition-colors"
                    aria-label={`Hapus ${item.menuItem.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Customizations: Spice & Notes */}
                {(item.spiceLevel !== undefined || item.notes) && (
                  <div className="flex flex-wrap gap-1.5 text-[11px] pt-1 border-t border-border/60">
                    {item.spiceLevel !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold">
                        <span>Level {item.spiceLevel}</span>
                      </span>
                    )}
                    {item.notes && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-ink-muted border border-border">
                        <FileText className="w-3 h-3 text-ink-light" />
                        <span className="truncate max-w-[200px]">{item.notes}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Quantity Control & Subtotal */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 bg-surface rounded-lg border border-border px-1.5 py-0.5">
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

                  <span className="text-sm font-bold text-ink">
                    {formatIDR(item.subtotal)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: Summary & Checkout button */}
        {items.length > 0 && (
          <div className="p-4 border-t border-border bg-surface space-y-3">
            {/* Non-authoritative Price Notice */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-muted text-ink-muted text-[11px] border border-border/80">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Total merupakan estimasi katalog. Harga final dihitung ulang otomatis oleh server saat order dibuat.
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs text-ink-muted">Estimasi Total</span>
                <span className="block text-lg font-extrabold text-ink">
                  {formatIDR(subtotalAmount)}
                </span>
              </div>
              <span className="text-xs font-semibold text-ink-muted bg-surface-muted px-2 py-1 rounded-md border border-border">
                {totalCount} item
              </span>
            </div>

            {/* Navigate to Checkout Page (/cart) */}
            <button
              type="button"
              onClick={() => {
                setIsCartOpen(false);
                navigate('/cart');
              }}
              className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-ink font-bold text-sm shadow-sm transition-smooth active:scale-98 flex items-center justify-center gap-2"
            >
              <span>Lanjut ke Checkout</span>
              <span className="text-base">→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
