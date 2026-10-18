export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string | null;
  image_url: string | null;
  photo_url?: string | null;
  is_available: boolean;
  available?: boolean;
  has_spice_level: boolean;
  sort_order?: number;
}

export type MenuCategory = 'Semua' | 'Ayam Geprek' | 'Ala Carte' | 'Minuman';

export interface MenuQueryFilter {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}
