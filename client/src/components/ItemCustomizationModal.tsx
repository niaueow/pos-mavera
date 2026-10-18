import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { MenuItem } from '../types/menu';
import { formatIDR } from '../utils/currency';

interface ItemCustomizationModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (params: {
    menuItem: MenuItem;
    quantity: number;
    spiceLevel?: number;
    notes?: string;
  }) => void;
}

const SPICE_LEVELS = [
  { level: 0, label: 'Level 0', desc: 'Tidak Pedas' },
  { level: 1, label: 'Level 1', desc: 'Pedas Ringan' },
  { level: 2, label: 'Level 2', desc: 'Pedas Sedang' },
  { level: 3, label: 'Level 3', desc: 'Pedas Mantap' },
  { level: 4, label: 'Level 4', desc: 'Sangat Pedas' },
  { level: 5, label: 'Level 5', desc: 'Extra Pedas · Paling menantang!' },
];

export const ItemCustomizationModal: React.FC<ItemCustomizationModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [spiceLevel, setSpiceLevel] = useState<number>(1);
  const [notes, setNotes] = useState('');

  // Reset form when modal opens with a new item
  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSpiceLevel(1);
      setNotes('');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleIncrement = () => {
    if (quantity < 50) setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) setQuantity((prev) => prev - 1);
  };

  const handleAddToCart = () => {
    onAddToCart({
      menuItem: item,
      quantity,
      spiceLevel: item.has_spice_level ? spiceLevel : undefined,
      notes: notes.trim() ? notes.trim() : undefined,
    });
    onClose();
  };

  const subtotal = item.price * quantity;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl border border-border shadow-modal overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
          <div>
            <h2 id="modal-title" className="text-base sm:text-lg font-regular text-ink-muted py-2">
              {item.name}
            </h2>
            <span className="text-base font-bold text-ink">{formatIDR(item.price)}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-ink">
          {/* Spice Level Section (Rendered ONLY if menu supports spice level) */}
          {item.has_spice_level ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span>Pilih Level Pedas (0–5)</span>
                  <span className="text-xs font-normal text-danger">*</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SPICE_LEVELS.map(({ level, label, desc }) => {
                  const isSelected = spiceLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSpiceLevel(level)}
                      className={`relative flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-smooth ${isSelected
                        ? 'bg-brand-subtle border-brand'
                        : 'bg-surface border-border hover:bg-surface-muted'
                        }`}
                    >

                      {/* Radio indicator */}
                      <span
                        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-smooth ${isSelected
                          ? 'border-brand bg-ink'
                          : 'border-ink-muted bg-surface'
                          }`}
                      >
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-surface block" />
                        )}
                      </span>

                      {/* Text */}
                      <span className="min-w-0">
                        <span className={`block text-sm font-bold leading-tight ${isSelected ? 'text-ink' : 'text-ink'
                          }`}>
                          {label}
                        </span>
                        <span className="block text-[11px] text-ink-muted leading-tight mt-0.5 truncate">
                          {desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Notes / Catatan Khusus */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="item-notes" className="text-sm font-bold text-ink">
                Catatan Khusus <span className="text-xs font-normal text-ink-muted">(Opsional)</span>
              </label>
              <span className="text-xs text-ink-muted">{notes.length}/150</span>
            </div>
            <textarea
              id="item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 150))}
              placeholder="Contoh: Sambal dipisah, tidak pakai lalapan, dll."
              rows={2}
              maxLength={150}
              className="w-full p-3 rounded-xl bg-surface border border-border text-sm text-ink placeholder:text-ink-light focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand resize-none"
            />
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-bold text-ink">Jumlah Pesanan</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={quantity <= 1}
                className={`w-9 h-9 rounded-lg border border-border flex items-center justify-center transition-smooth ${quantity <= 1
                  ? 'opacity-40 cursor-not-allowed bg-surface-muted'
                  : 'bg-brand hover:bg-surface-muted text-ink active:scale-95'
                  }`}
                aria-label="Kurangi jumlah"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-base font-bold text-ink">
                {quantity}
              </span>
              <button
                type="button"
                onClick={handleIncrement}
                disabled={quantity >= 50}
                className={`w-9 h-9 rounded-lg border border-border flex items-center justify-center transition-smooth ${quantity >= 50
                  ? 'opacity-40 cursor-not-allowed bg-surface-muted'
                  : 'bg-brand hover:bg-surface-muted text-ink active:scale-95'
                  }`}
                aria-label="Tambah jumlah"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-border bg-surface flex items-center justify-between gap-3">
          <div>
            <span className="block text-[11px] text-ink-muted">Subtotal Item</span>
            <span className="text-base font-extrabold text-ink">
              {formatIDR(subtotal)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className="flex-1 max-w-xs flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-ink font-bold text-sm transition-smooth active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Tambah ke Keranjang</span>
          </button>
        </div>
      </div>
    </div>
  );
};
