import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SearchBar } from '../components/SearchBar';
import { MenuCard } from '../components/MenuCard';
import { MenuSkeleton } from '../components/MenuSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { ItemCustomizationModal } from '../components/ItemCustomizationModal';
import { useCart } from '../hooks/useCart';
import { getMenus } from '../services/menuService';
import { MenuItem, MenuCategory } from '../types/menu';
import { ApiClientError } from '../services/apiClient';

export const MenuPage: React.FC = () => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>('Semua');

  // Customization modal state
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const { addItem } = useCart();

  const loadMenus = useCallback(async (search: string, category: MenuCategory) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getMenus({
        search: search.trim() ? search.trim() : undefined,
        category: category !== 'Semua' ? category : undefined,
      });
      setMenus(response.data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Gagal memuat katalog menu. Silakan coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search & category trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      loadMenus(searchQuery, selectedCategory);
    }, 250);

    return () => clearTimeout(handler);
  }, [searchQuery, selectedCategory, loadMenus]);

  const handleSelectMenuItem = (item: MenuItem) => {
    setCustomizingItem(item);
    setIsModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Semua');
  };

  // Grouped counts by category for user feedback
  const filteredCategoryCount = useMemo(() => {
    return menus.length;
  }, [menus]);

  return (
    <div className="pb-24 pt-4 sm:pt-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Banner Promo / Slogan */}
        <div className="relative overflow-hidden bg-brand-subtle rounded-2xl border border-brand/20 p-4 sm:p-6 mb-6">
          <div className="max-w-xl">
            <span className="inline-block px-2.5 py-1 rounded-md bg-brand text-ink text-xs font-bold mb-2 shadow-xs">
              🍗 Pilihan Juara Setiap Hari
            </span>
            <h2 className="text-lg sm:text-2xl font-extrabold text-ink leading-tight">
              Ayam Geprek Sambal Mantap, Gurih & Renyah
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
              Pilih menu paket hemat, ala carte lezat, dan minuman segar langsung dari meja Anda.
            </p>
          </div>
        </div>

        {/* Search Bar & Category Navigation */}
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Catalog Section Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <span>{selectedCategory === 'Semua' ? 'Semua Menu' : selectedCategory}</span>
            {!isLoading && (
              <span className="text-xs font-semibold text-ink-muted bg-surface px-2 py-0.5 rounded-full border border-border">
                {filteredCategoryCount} menu
              </span>
            )}
          </h3>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <MenuSkeleton count={6} />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => loadMenus(searchQuery, selectedCategory)}
          />
        ) : menus.length === 0 ? (
          <EmptyState
            title="Menu Tidak Ditemukan"
            message={`Tidak ada menu yang cocok untuk "${searchQuery || selectedCategory}". Coba cari kata kunci lain.`}
            onAction={handleResetFilters}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {menus.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                onSelect={handleSelectMenuItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Item Customization Modal */}
      <ItemCustomizationModal
        item={customizingItem}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddToCart={addItem}
      />
    </div>
  );
};
