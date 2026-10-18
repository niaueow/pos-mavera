import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

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
  status: z.nativeEnum(OrderStatus, {
    errorMap: () => ({ message: 'Status pesanan tidak valid' }),
  }),
  reason: z.string().trim().max(255).optional(),
});

export const orderIdParamSchema = z.object({
  order_id: z.coerce
    .number({ invalid_type_error: 'Order ID harus berupa angka' })
    .int()
    .positive(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
