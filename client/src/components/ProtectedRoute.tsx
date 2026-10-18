import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * ProtectedRoute — renders children only when user is authenticated.
 * Redirects to /staff/login if no valid session is found.
 *
 * NOTE: This route guard is a UX convenience, NOT a security measure.
 * Every protected backend endpoint validates the JWT independently.
 */
export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-ink-muted font-medium">Memverifikasi sesi...</span>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/staff/login" replace />;
};
