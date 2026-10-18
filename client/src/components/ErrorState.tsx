import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Gagal Memuat Menu',
  message = 'Terjadi kendala saat memuat data dari server. Pastikan server backend sedang aktif.',
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div className="bg-danger-surface rounded-xl border border-danger/30 p-6 text-center flex flex-col items-center justify-center my-6">
      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-danger mb-3 shadow-subtle">
        <AlertTriangle className="w-6 h-6 text-danger" />
      </div>
      <h3 className="text-base font-bold text-danger mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-ink-muted max-w-md mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger text-white text-xs sm:text-sm font-semibold hover:bg-danger/90 active:scale-95 transition-smooth disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Mencoba lagi...' : 'Coba Lagi'}</span>
        </button>
      )}
    </div>
  );
};
