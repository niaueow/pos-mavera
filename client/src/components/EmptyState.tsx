import React from 'react';
import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Menu Tidak Ditemukan',
  message = 'Tidak ada menu yang sesuai dengan pencarian atau filter yang dipilih.',
  actionText = 'Reset Pencarian',
  onAction,
}) => {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center flex flex-col items-center justify-center my-6 shadow-subtle">
      <div className="w-14 h-14 rounded-full bg-brand-subtle flex items-center justify-center text-ink-muted mb-3">
        <SearchX className="w-7 h-7 text-amber-700" />
      </div>
      <h3 className="text-base font-bold text-ink mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-ink-muted max-w-sm mb-4">{message}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-xl bg-surface-muted hover:bg-border text-ink text-xs sm:text-sm font-semibold border border-border transition-smooth"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
