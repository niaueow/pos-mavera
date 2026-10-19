import React from 'react';
import { Plus, Flame, Utensils } from 'lucide-react';
import { MenuItem } from '../types/menu';
import { formatIDR } from '../utils/currency';

interface MenuCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({ item, onSelect }) => {
  const isAvailable = item.is_available ?? item.available ?? true;


  return (
    <div
      className={`group relative flex flex-col justify-between bg-surface rounded-xl border border-border p-4 transition-smooth shadow-subtle hover:shadow-card ${
        !isAvailable ? 'opacity-60 bg-surface-muted cursor-not-allowed' : ''
      }`}
    >
      <div>
        {/* Header: Category Badge & Availability Tag */}
        
        {/* <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-muted text-ink-muted text-[11px] font-medium border border-border">
            <span>{item.category}</span>
          </span>

          {!isAvailable ? (
            <span className="px-2 py-0.5 rounded-md bg-danger-surface text-danger text-[11px] font-bold">
              Habis
            </span>
          ) : item.has_spice_level ? (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] font-semibold">
              <Flame className="w-3 h-3 text-red-500 fill-red-500" />
              <span>Pedas 1–5</span>
            </span>
          ) : null}
        </div> */ }

        {/* Image / Placeholder Banner */}
        <div className="relative w-full h-52 mb-3 rounded-lg overflow-hidden bg-brand-subtle flex items-center justify-center border border-border/60">
          {item.image_url || item.photo_url ? (
            <img
              src={item.image_url || item.photo_url || ''}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-ink-muted">
              <span className="text-[11px] font-medium text-ink-light flex items-center gap-1">
                <Utensils className="w-3 h-3" /> Mavera Rasa Juara
              </span>
            </div>
          )}
        </div>

        {/* Menu Title */}
        <h3 className="text-sm sm:text-base font-bold text-ink leading-snug line-clamp-2 mb-1 group-hover:text-amber-700 transition-colors">
          {item.name}
        </h3>

        {/* Menu Description (if provided) */}
        {item.description && (
          <p className="text-xs text-ink-muted line-clamp-2 mb-3">
            {item.description}
          </p>
        )}
      </div>

      {/* Footer: Price & Add Action */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div>
          <span className="text-sm sm:text-base font-bold text-ink">
            {formatIDR(item.price)}
          </span>
        </div>

        <button
          onClick={() => isAvailable && onSelect(item)}
          disabled={!isAvailable}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-smooth active:scale-95 ${
            isAvailable
              ? 'bg-brand hover:bg-brand-hover text-ink shadow-sm'
              : 'bg-surface-muted text-ink-light border border-border cursor-not-allowed'
          }`}
          aria-label={`Tambah ${item.name} ke keranjang`}
        >
          <Plus className="w-4 h-4" />
          <span>{isAvailable ? 'Tambah' : 'Habis'}</span>
        </button>
      </div>
    </div>
  );
};
