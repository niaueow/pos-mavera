import { z } from 'zod';
import { OrderType } from '@prisma/client';

const rawOrderItemSchema = z
  .object({
    menu_id: z.number().int().positive().optional(),
    menuId: z.number().int().positive().optional(),
    quantity: z
      .number({
        required_error: 'Jumlah pesanan (quantity) wajib diisi',
        invalid_type_error: 'Jumlah pesanan (quantity) harus berupa angka',
      })
      .int('Jumlah pesanan (quantity) harus bilangan bulat')
      .min(1, 'Jumlah pesanan minimal 1')
      .max(99, 'Jumlah pesanan maksimal 99 per item'),
    spice_level: z
      .number({ invalid_type_error: 'Level pedas harus berupa angka' })
      .int('Level pedas harus bilangan bulat')
      .min(0, 'Level pedas minimal 0')
      .max(5, 'Level pedas maksimal 5')
      .nullable()
      .optional(),
    spiceLevel: z
      .number({ invalid_type_error: 'Level pedas harus berupa angka' })
      .int('Level pedas harus bilangan bulat')
      .min(0, 'Level pedas minimal 0')
      .max(5, 'Level pedas maksimal 5')
      .nullable()
      .optional(),
    notes: z
      .string()
      .trim()
      .max(150, 'Catatan item maksimal 150 karakter')
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const resolvedMenuId = data.menu_id ?? data.menuId;
    if (resolvedMenuId === undefined || resolvedMenuId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['menu_id'],
        message: 'menu_id wajib diisi dan berupa angka bulat positif',
      });
    }
  });

export const createOrderSchema = z
  .object({
    customer: z
      .object({
        name: z.string().trim().min(1, 'Nama pemesan wajib diisi').max(100, 'Nama maksimal 100 karakter').optional(),
        phone_number: z.string().trim().optional(),
        phone: z.string().trim().optional(),
      })
      .optional(),
    customer_name: z.string().trim().max(100, 'Nama maksimal 100 karakter').optional(),
    customerName: z.string().trim().max(100, 'Nama maksimal 100 karakter').optional(),
    customer_phone: z.string().trim().optional(),
    customerPhone: z.string().trim().optional(),
    order_type: z
      .nativeEnum(OrderType, {
        errorMap: () => ({ message: 'Tipe pesanan harus DINE_IN atau TAKEAWAY' }),
      })
      .optional(),
    orderType: z
      .nativeEnum(OrderType, {
        errorMap: () => ({ message: 'Tipe pesanan harus DINE_IN atau TAKEAWAY' }),
      })
      .optional(),
    table_number: z
      .number({ invalid_type_error: 'Nomor meja harus berupa angka bulat antara 1 sampai 10' })
      .int('Nomor meja harus berupa angka bulat')
      .nullable()
      .optional(),
    tableNumber: z
      .number({ invalid_type_error: 'Nomor meja harus berupa angka bulat antara 1 sampai 10' })
      .int('Nomor meja harus berupa angka bulat')
      .nullable()
      .optional(),
    notes: z
      .string()
      .trim()
      .max(255, 'Catatan pesanan maksimal 255 karakter')
      .nullable()
      .optional(),
    items: z
      .array(rawOrderItemSchema, {
        required_error: 'Daftar item pesanan (items) wajib diisi',
        invalid_type_error: 'Daftar item pesanan (items) harus berupa array',
      })
      .min(1, 'Pesanan harus memiliki minimal 1 item')
      .max(50, 'Pesanan maksimal terdiri dari 50 item'),
  })
  .superRefine((data, ctx) => {
    // 1. Validate Customer Name
    const customerName = (
      data.customer?.name ??
      data.customer_name ??
      data.customerName ??
      ''
    ).trim();

    if (!customerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customer_name'],
        message: 'Nama pemesan wajib diisi',
      });
    } else if (customerName.length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customer_name'],
        message: 'Nama pemesan maksimal 100 karakter',
      });
    }

    // 2. Validate Customer Phone
    const customerPhone = (
      data.customer?.phone_number ??
      data.customer?.phone ??
      data.customer_phone ??
      data.customerPhone ??
      ''
    ).trim();

    if (!customerPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customer_phone'],
        message: 'Nomor telepon pemesan wajib diisi',
      });
    } else if (!/^\+?[0-9]{8,20}$/.test(customerPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customer_phone'],
        message: 'Format nomor telepon tidak valid (8–20 digit angka)',
      });
    }

    // 3. Validate Order Type (DINE_IN or TAKEAWAY)
    const orderType = data.order_type ?? data.orderType;
    if (!orderType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['order_type'],
        message: 'Tipe pesanan wajib diisi (DINE_IN atau TAKEAWAY)',
      });
      return;
    }

    // 4. Validate Table Number based on Order Type
    const rawTableNumber =
      data.table_number !== undefined ? data.table_number : data.tableNumber;

    if (orderType === OrderType.DINE_IN) {
      if (rawTableNumber === undefined || rawTableNumber === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['table_number'],
          message: 'Nomor meja wajib diisi (1–10) untuk pesanan Dine-in',
        });
      } else if (rawTableNumber < 1 || rawTableNumber > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['table_number'],
          message: 'Nomor meja untuk Dine-in harus berada di antara 1 sampai 10',
        });
      }
    } else if (orderType === OrderType.TAKEAWAY) {
      if (rawTableNumber !== undefined && rawTableNumber !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['table_number'],
          message: 'Nomor meja harus dikosongkan untuk pesanan Takeaway',
        });
      }
    }
  })
  .transform((data) => {
    const customerName = (
      data.customer?.name ??
      data.customer_name ??
      data.customerName ??
      ''
    ).trim();

    const customerPhone = (
      data.customer?.phone_number ??
      data.customer?.phone ??
      data.customer_phone ??
      data.customerPhone ??
      ''
    ).trim();

    const orderType = (data.order_type ?? data.orderType)!;
    const rawTableNumber =
      data.table_number !== undefined ? data.table_number : data.tableNumber;

    return {
      customerName,
      customerPhone,
      orderType,
      tableNumber: orderType === OrderType.DINE_IN ? (rawTableNumber as number) : null,
      notes: data.notes ? data.notes.trim() : null,
      items: data.items.map((item) => ({
        menuId: (item.menu_id ?? item.menuId)!,
        quantity: item.quantity,
        spiceLevel:
          item.spice_level !== undefined
            ? item.spice_level
            : item.spiceLevel !== undefined
              ? item.spiceLevel
              : null,
        notes: item.notes ? item.notes.trim() : null,
      })),
    };
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
