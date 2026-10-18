import React from 'react';
import { Search, X } from 'lucide-react';
import { MenuCategory } from '../types/menu';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: MenuCategory;
  onSelectCategory: (category: MenuCategory) => void;
}

const CATEGORIES: { label: MenuCategory; emoji: string }[] = [
  { label: 'Semua', emoji: '🍽️' },
  { label: 'Ayam Geprek', emoji: '🍗' },
  { label: 'Ala Carte', emoji: '🍳' },
  { label: 'Minuman', emoji: '🥤' },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="space-y-3.5 mb-6">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari menu favoritmu (contoh: Paket A, Es Teh)..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface border border-border text-ink placeholder:text-ink-light text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand shadow-subtle transition-smooth"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-muted hover:text-ink transition-colors"
            aria-label="Hapus pencarian"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(({ label, emoji }) => {
          const isActive = selectedCategory === label;
          return (
            <button
              key={label}
              onClick={() => onSelectCategory(label)}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-smooth flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-brand text-ink border-brand shadow-sm font-bold'
                  : 'bg-surface text-ink-muted border-border hover:bg-surface-muted hover:text-ink'
              }`}
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
