import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VALID_TABLE_NUMBERS,
  normalizeCustomerPhone,
  validateCheckoutForm,
  buildCreateOrderPayload,
  createOrder,
} from '../services/orderService';
import * as apiClient from '../services/apiClient';
import { CartItem } from '../types/cart';
import { MenuItem } from '../types/menu';
import { CreateOrderResponse } from '../types/order';

vi.mock('../services/apiClient', async () => {
  const actual = await vi.importActual<typeof apiClient>('../services/apiClient');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

describe('Milestone 4 — Customer Checkout Validation & API Integration', () => {
  const spicyMenu: MenuItem = {
    id: 1,
    name: 'Paket A (Ayam Geprek + Nasi + Es Teh)',
    price: 20000,
    category: 'Ayam Geprek',
    description: 'Ayam geprek sambal korek',
    image_url: null,
    is_available: true,
    has_spice_level: true,
  };

  const drinkMenu: MenuItem = {
    id: 2,
    name: 'Es Teh Manis',
    price: 4000,
    category: 'Minuman',
    description: 'Es teh manis segar',
    image_url: null,
    is_available: true,
    has_spice_level: false,
  };

  const sampleCartItems: CartItem[] = [
    {
      cartItemId: '1__spice_3__sambal_pisah',
      menuItem: spicyMenu,
      quantity: 2,
      spiceLevel: 3,
      notes: 'Sambal pisah',
      unitPrice: 20000,
      subtotal: 40000,
    },
    {
      cartItemId: '2__no_spice__',
      menuItem: drinkMenu,
      quantity: 1,
      spiceLevel: undefined,
      notes: undefined,
      unitPrice: 4000,
      subtotal: 4000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides valid table numbers from 1 to 10', () => {
    expect(VALID_TABLE_NUMBERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('requires tableNumber (1-10) when orderType is DINE_IN', () => {
    const missingTable = validateCheckoutForm({
      customerName: 'Budi Santoso',
      phoneNumber: '81234567890',
      orderType: 'DINE_IN',
      tableNumber: null,
      items: sampleCartItems,
    });
    expect(missingTable.isValid).toBe(false);
    expect(missingTable.errors.tableNumber).toBeDefined();

    const invalidTableOutOfRange = validateCheckoutForm({
      customerName: 'Budi Santoso',
      phoneNumber: '81234567890',
      orderType: 'DINE_IN',
      tableNumber: 12,
      items: sampleCartItems,
    });
    expect(invalidTableOutOfRange.isValid).toBe(false);

    const validDineIn = validateCheckoutForm({
      customerName: 'Budi Santoso',
      phoneNumber: '81234567890',
      orderType: 'DINE_IN',
      tableNumber: 5,
      items: sampleCartItems,
    });
    expect(validDineIn.isValid).toBe(true);
    expect(validDineIn.errors).toEqual({});
  });

  it('does NOT require tableNumber when orderType is TAKEAWAY and forces table_number to null in payload', () => {
    const takeawayValidation = validateCheckoutForm({
      customerName: 'Siti Aminah',
      phoneNumber: '81298765432',
      orderType: 'TAKEAWAY',
      tableNumber: null,
      items: sampleCartItems,
    });
    expect(takeawayValidation.isValid).toBe(true);

    const payload = buildCreateOrderPayload({
      customerName: 'Siti Aminah',
      phoneNumber: '81298765432',
      orderType: 'TAKEAWAY',
      tableNumber: 5, // Even if a stale tableNumber was passed, TAKEAWAY must nullify it
      notes: 'Bungkus rapi',
      items: sampleCartItems,
    });

    expect(payload.order_type).toBe('TAKEAWAY');
    expect(payload.table_number).toBeNull();
    expect(payload.customer_phone).toBe('+6281298765432');
  });

  it('normalizes Indonesian phone numbers accurately', () => {
    expect(normalizeCustomerPhone('812 3456 7890')).toBe('+6281234567890');
    expect(normalizeCustomerPhone('081234567890')).toBe('081234567890');
    expect(normalizeCustomerPhone('6281234567890')).toBe('+6281234567890');
  });

  it('calls POST /orders with authoritative payload and returns created order with tracking_token', async () => {
    const mockOrderResponse: CreateOrderResponse = {
      id: 101,
      order_id: 101,
      order_code: 'MVR-8K2P7X',
      customer_name: 'Budi Santoso',
      customer_phone: '+6281234567890',
      order_type: 'DINE_IN',
      table_number: 4,
      items: [
        {
          id: 1,
          menu_id: 1,
          name: spicyMenu.name,
          menu_name: spicyMenu.name,
          unit_price: 20000,
          quantity: 2,
          spice_level: 3,
          notes: 'Sambal pisah',
          subtotal: 40000,
        },
        {
          id: 2,
          menu_id: 2,
          name: drinkMenu.name,
          menu_name: drinkMenu.name,
          unit_price: 4000,
          quantity: 1,
          spice_level: null,
          notes: null,
          subtotal: 4000,
        },
      ],
      total: 44000,
      total_amount: 44000,
      notes: null,
      order_status: 'PENDING_PAYMENT',
      payment_status: 'PENDING',
      tracking_token: 'abc123def4567890abc123def4567890abc123def4567890abc123def4567890',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(apiClient.apiRequest).mockResolvedValueOnce({
      success: true,
      message: 'Pesanan berhasil dibuat',
      data: mockOrderResponse,
    });

    const payload = buildCreateOrderPayload({
      customerName: 'Budi Santoso',
      phoneNumber: '81234567890',
      orderType: 'DINE_IN',
      tableNumber: 4,
      items: sampleCartItems,
    });

    const result = await createOrder(payload);

    expect(apiClient.apiRequest).toHaveBeenCalledWith('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(result.order_code).toBe('MVR-8K2P7X');
    expect(result.table_number).toBe(4);
    expect(result.total_amount).toBe(44000);
    expect(result.tracking_token).toHaveLength(64);
  });
});
