import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { formatIDR } from '../utils/currency';

export const MobileCartBar: React.FC = () => {
  const { totalCount, subtotalAmount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  if (totalCount === 0 || location.pathname === '/cart') return null;

  return (
    <div className="sm:hidden fixed bottom-4 inset-x-4 z-20">
      <button
        onClick={() => navigate('/cart')}
        className="w-full bg-brand text-ink rounded-xl p-3.5 shadow-elevated border border-brand-hover flex items-center justify-between font-bold active:scale-98 transition-transform"
        aria-label={`Buka Keranjang: ${totalCount} item, total ${formatIDR(subtotalAmount)}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-ink" />
            <span className="absolute -top-2 -right-2 bg-ink text-surface text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {totalCount}
            </span>
          </div>
          <span className="text-sm font-bold text-ink">Lanjut ke Checkout</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-extrabold text-ink">
            {formatIDR(subtotalAmount)}
          </span>
          <ChevronRight className="w-4 h-4 text-ink" />
        </div>
      </button>
    </div>
  );
};
