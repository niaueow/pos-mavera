import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './hooks/useCart';
import { Navbar } from './components/Navbar';
import { CartDrawer } from './components/CartDrawer';
import { MobileCartBar } from './components/MobileCartBar';
import { MenuPage } from './pages/MenuPage';
import { CartPage } from './pages/CartPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <CartProvider>
        <div className="min-h-screen bg-surface-muted text-ink flex flex-col font-sans selection:bg-brand selection:text-ink">
          {/* Header */}
          <Navbar />

          {/* Main Views */}
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<MenuPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Slide-over Cart Drawer for instant access on any page */}
          <CartDrawer />

          {/* Sticky Mobile Cart Bar for quick checkout peek */}
          <MobileCartBar />
        </div>
      </CartProvider>
    </BrowserRouter>
  );
};

export default App;
