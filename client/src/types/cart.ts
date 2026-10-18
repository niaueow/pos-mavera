import { MenuItem } from './menu';

export interface CartItem {
  cartItemId: string;
  menuItem: MenuItem;
  quantity: number;
  spiceLevel?: number;
  notes?: string;
  unitPrice: number;
  subtotal: number;
}
