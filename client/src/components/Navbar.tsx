import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { formatIDR } from '../utils/currency';


export const Navbar: React.FC = () => {
  const { totalCount, subtotalAmount } = useCart();


  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border shadow-subtle">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo & Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-ink shadow-sm">
            <UtensilsCrossed className="w-5 h-5 text-ink" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink leading-tight tracking-tight">
              Ayam Geprek <span className="text-amber-600">Mavera</span>
            </h1>
            <p className="text-xs text-ink-muted">Pesan Makanan & Lacak Pesanan</p>
          </div>
        </div>

        {/* Cart button → navigates to /cart page */}
        <Link
          to="/cart"
          className="relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-ink font-semibold transition-smooth active:scale-95 shadow-sm"
          aria-label={`Buka Keranjang (${totalCount} item)`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {totalCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-ink text-surface text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-brand">
                {totalCount}
              </span>
            )}
          </div>
          <span className="hidden sm:inline text-sm font-bold">
            {totalCount > 0 ? formatIDR(subtotalAmount) : 'Keranjang'}
          </span>
        </Link>
      </div>
    </header>
  );
};
