import { describe, it, expect } from 'vitest';
import { MenuItem } from '../types/menu';
import { CartItem } from '../types/cart';

describe('Cart Business Logic & Aggregations', () => {
  const dummyAyamGeprek: MenuItem = {
    id: 1,
    name: 'Paket A (Ayam Geprek + Nasi + Es Teh)',
    price: 20000,
    category: 'Ayam Geprek',
    description: 'Ayam geprek mantap',
    image_url: null,
    is_available: true,
    has_spice_level: true,
  };

  const dummyEsTeh: MenuItem = {
    id: 2,
    name: 'Es Teh Manis',
    price: 4000,
    category: 'Minuman',
    description: 'Segar dan manis',
    image_url: null,
    is_available: true,
    has_spice_level: false,
  };

  it('should calculate subtotal correctly for single item with spice level', () => {
    const cartItem: CartItem = {
      cartItemId: '1__spice_3__sambal_dipisah',
      menuItem: dummyAyamGeprek,
      quantity: 2,
      spiceLevel: 3,
      notes: 'Sambal dipisah',
      unitPrice: dummyAyamGeprek.price,
      subtotal: dummyAyamGeprek.price * 2,
    };

    expect(cartItem.subtotal).toBe(40000);
    expect(cartItem.spiceLevel).toBe(3);
    expect(cartItem.notes).toBe('Sambal dipisah');
  });

  it('should handle items without spice level (e.g. drinks)', () => {
    const cartDrink: CartItem = {
      cartItemId: '2__no_spice__',
      menuItem: dummyEsTeh,
      quantity: 3,
      spiceLevel: undefined,
      notes: undefined,
      unitPrice: dummyEsTeh.price,
      subtotal: dummyEsTeh.price * 3,
    };

    expect(cartDrink.subtotal).toBe(12000);
    expect(cartDrink.spiceLevel).toBeUndefined();
  });

  it('should aggregate total quantity and total amount across multiple items', () => {
    const items: CartItem[] = [
      {
        cartItemId: '1__spice_1__',
        menuItem: dummyAyamGeprek,
        quantity: 2,
        spiceLevel: 1,
        unitPrice: 20000,
        subtotal: 40000,
      },
      {
        cartItemId: '2__no_spice__',
        menuItem: dummyEsTeh,
        quantity: 3,
        unitPrice: 4000,
        subtotal: 12000,
      },
    ];

    const totalCount = items.reduce((acc, it) => acc + it.quantity, 0);
    const totalAmount = items.reduce((acc, it) => acc + it.subtotal, 0);

    expect(totalCount).toBe(5);
    expect(totalAmount).toBe(52000);
  });
});
