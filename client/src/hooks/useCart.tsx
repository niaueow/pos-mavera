import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { MenuItem } from '../types/menu';
import { CartItem } from '../types/cart';

interface AddItemParams {
  menuItem: MenuItem;
  quantity: number;
  spiceLevel?: number;
  notes?: string;
}

interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  subtotalAmount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addItem: (params: AddItemParams) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
}

const CART_STORAGE_KEY = 'pos_mavera_cart_v1';
const MAX_QUANTITY_PER_ITEM = 50;

const CartContext = createContext<CartContextValue | undefined>(undefined);

function generateCartItemId(menuId: number, spiceLevel?: number, notes?: string): string {
  const normNotes = (notes || '').trim().toLowerCase();
  const spiceKey = spiceLevel !== undefined ? `spice_${spiceLevel}` : 'no_spice';
  return `${menuId}__${spiceKey}__${normNotes}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as CartItem[];
      }
    } catch {
      // LocalStorage unavailable or corrupt
    }
    return [];
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota error
    }
  }, [items]);

  const addItem = ({ menuItem, quantity, spiceLevel, notes }: AddItemParams) => {
    if (quantity <= 0) return;

    const trimmedNotes = notes?.trim() || undefined;
    const cartItemId = generateCartItemId(menuItem.id, spiceLevel, trimmedNotes);

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((it) => it.cartItemId === cartItemId);

      if (existingIndex > -1) {
        const current = prevItems[existingIndex];
        const newQty = Math.min(current.quantity + quantity, MAX_QUANTITY_PER_ITEM);
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...current,
          quantity: newQty,
          subtotal: current.unitPrice * newQty,
        };
        return updated;
      }

      const clampedQty = Math.min(quantity, MAX_QUANTITY_PER_ITEM);
      const newItem: CartItem = {
        cartItemId,
        menuItem,
        quantity: clampedQty,
        spiceLevel,
        notes: trimmedNotes,
        unitPrice: menuItem.price,
        subtotal: menuItem.price * clampedQty,
      };

      return [...prevItems, newItem];
    });
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    setItems((prevItems) => {
      if (quantity <= 0) {
        return prevItems.filter((it) => it.cartItemId !== cartItemId);
      }
      const clampedQty = Math.min(quantity, MAX_QUANTITY_PER_ITEM);
      return prevItems.map((it) => {
        if (it.cartItemId === cartItemId) {
          return {
            ...it,
            quantity: clampedQty,
            subtotal: it.unitPrice * clampedQty,
          };
        }
        return it;
      });
    });
  };

  const removeItem = (cartItemId: string) => {
    setItems((prevItems) => prevItems.filter((it) => it.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const { totalCount, subtotalAmount } = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        totalCount: acc.totalCount + item.quantity,
        subtotalAmount: acc.subtotalAmount + item.subtotal,
      }),
      { totalCount: 0, subtotalAmount: 0 }
    );
  }, [items]);

  const value: CartContextValue = {
    items,
    totalCount,
    subtotalAmount,
    isCartOpen,
    setIsCartOpen,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
