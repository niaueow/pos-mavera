import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './hooks/useCart';
import { AuthProvider } from './hooks/useAuth';
import { Navbar } from './components/Navbar';
import { MobileCartBar } from './components/MobileCartBar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MenuPage } from './pages/MenuPage';
import { CartPage } from './pages/CartPage';
import { StaffLoginPage } from './pages/StaffLoginPage';
import { StaffDashboardPage } from './pages/StaffDashboardPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* ── Staff routes: standalone layout, no Navbar ── */}
            <Route path="/staff/login" element={<StaffLoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/staff/orders" element={<StaffDashboardPage />} />
            </Route>

            {/* ── Menu + Cart: shared Navbar + cart UX ── */}
            <Route
              path="/*"
              element={
                <div className="min-h-screen bg-surface-muted text-ink flex flex-col font-sans selection:bg-brand selection:text-ink">
                  <Navbar />
                  <main className="flex-1">
                    <Routes>
                      <Route path="/" element={<MenuPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                  <MobileCartBar />
                </div>
              }
            />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
