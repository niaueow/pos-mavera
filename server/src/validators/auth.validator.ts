import { z } from 'zod';
import { OrderStatus, OrderType } from '@prisma/client';

const STATUS_ALIAS_MAP: Record<string, OrderStatus> = {
  'MENUNGGU PEMBAYARAN': OrderStatus.PENDING_PAYMENT,
  'PESANAN DITERIMA': OrderStatus.RECEIVED,
  'SEDANG DIMASAK': OrderStatus.PREPARING,
  'SEDANG DIPROSES': OrderStatus.PREPARING,
  'PESANAN SIAP': OrderStatus.READY,
  'PESANAN SIAP DIAMBIL': OrderStatus.READY,
  'SIAP DIAMBIL': OrderStatus.READY,
  'SELESAI': OrderStatus.COMPLETED,
  'PESANAN SELESAI': OrderStatus.COMPLETED,
  'DIBATALKAN': OrderStatus.CANCELLED,
};

function normalizeStatusInput(val: unknown): unknown {
  if (typeof val === 'string') {
    const trimmed = val.trim().toUpperCase();
    if (trimmed in STATUS_ALIAS_MAP) {
      return STATUS_ALIAS_MAP[trimmed];
    }
    return trimmed;
  }
  return val;
}

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid'),
  password: z
    .string()
    .min(6, 'Password minimal 6 karakter'),
});

export const updateOrderStatusSchema = z.object({
  status: z.preprocess(
    normalizeStatusInput,
    z.nativeEnum(OrderStatus, {
      errorMap: () => ({ message: 'Status pesanan tidak valid' }),
    })
  ),
  reason: z.string().trim().max(255).optional(),
});

export const orderIdParamSchema = z.object({
  order_id: z.coerce
    .number({ invalid_type_error: 'Order ID harus berupa angka' })
    .int()
    .positive(),
});

export const staffOrderIdParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'ID pesanan harus berupa angka bulat positif' })
    .int('ID pesanan harus berupa bilangan bulat')
    .positive('ID pesanan harus lebih besar dari 0'),
});

export const getStaffOrdersQuerySchema = z.object({
  status: z
    .preprocess(
      normalizeStatusInput,
      z.nativeEnum(OrderStatus, {
        errorMap: () => ({ message: 'Filter status pesanan tidak valid' }),
      })
    )
    .optional(),
  today: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  order_type: z
    .nativeEnum(OrderType, {
      errorMap: () => ({ message: 'Filter tipe pesanan harus DINE_IN atau TAKEAWAY' }),
    })
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type GetStaffOrdersQuery = z.infer<typeof getStaffOrdersQuerySchema>;

