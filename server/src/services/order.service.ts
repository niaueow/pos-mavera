import crypto from 'crypto';
import { Menu, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/errorHandler';
import { CreateOrderInput } from '../validators/order.validator';
import { ApiErrorDetail } from '../utils/response';

const ORDER_CODE_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ORDER_CODE_LENGTH = 6;

/**
 * Generates a formatted order code (e.g., MVR-8K2P7X) using cryptographic randomness.
 */
export function generateOrderCode(): string {
  let suffix = '';
  for (let i = 0; i < ORDER_CODE_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, ORDER_CODE_CHARSET.length);
    suffix += ORDER_CODE_CHARSET[randomIndex];
  }
  return `MVR-${suffix}`;
}

/**
 * Generates a unique orderCode guaranteed not to collide in the database.
 */
export async function generateUniqueOrderCode(
  tx: Prisma.TransactionClient = prisma,
  maxAttempts = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateOrderCode();
    const existing = await tx.order.findUnique({
      where: { orderCode: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  throw new AppError(500, 'ORDER_CODE_GENERATION_FAILED', 'Gagal menghasilkan kode pesanan unik');
}

/**
 * Generates a high-entropy 256-bit (64 hex chars) tracking token and its SHA-256 hash.
 * Only the SHA-256 hash is persisted in the database.
 */
export function generateTrackingToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

export interface CalculatedOrderItem {
  menuId: number;
  menuName: string;
  unitPrice: number;
  quantity: number;
  spiceLevel: number | null;
  notes: string | null;
  subtotal: number;
}

export interface CalculatedOrderPricing {
  items: CalculatedOrderItem[];
  totalAmount: number;
}

/**
 * Authoritative server-side price calculation and menu/spice-level validation.
 * Ignores any client-supplied prices or totals to prevent price tampering.
 */
export function calculateOrderPricing(
  requestedItems: CreateOrderInput['items'],
  menuMap: Map<number, Menu>
): CalculatedOrderPricing {
  const validationErrors: ApiErrorDetail[] = [];
  const calculatedItems: CalculatedOrderItem[] = [];
  let totalAmount = 0;

  requestedItems.forEach((reqItem, index) => {
    const menu = menuMap.get(reqItem.menuId);

    if (!menu || menu.isDeleted || !menu.isAvailable) {
      validationErrors.push({
        field: `items.${index}.menu_id`,
        message: `Menu dengan ID ${reqItem.menuId} tidak ditemukan atau sedang tidak tersedia`,
      });
      return;
    }

    // Validate spice level against menu's hasSpiceLevel configuration
    if (menu.hasSpiceLevel) {
      if (reqItem.spiceLevel === null || reqItem.spiceLevel === undefined) {
        validationErrors.push({
          field: `items.${index}.spice_level`,
          message: `Level pedas (0–5) wajib dipilih untuk menu "${menu.name}"`,
        });
        return;
      }
      if (
        !Number.isInteger(reqItem.spiceLevel) ||
        reqItem.spiceLevel < 0 ||
        reqItem.spiceLevel > 5
      ) {
        validationErrors.push({
          field: `items.${index}.spice_level`,
          message: `Level pedas untuk menu "${menu.name}" harus berada di antara 0 sampai 5`,
        });
        return;
      }
    } else {
      if (reqItem.spiceLevel !== null && reqItem.spiceLevel !== undefined) {
        validationErrors.push({
          field: `items.${index}.spice_level`,
          message: `Menu "${menu.name}" tidak memiliki pilihan level pedas`,
        });
        return;
      }
    }

    const unitPrice = menu.price;
    const subtotal = unitPrice * reqItem.quantity;
    totalAmount += subtotal;

    calculatedItems.push({
      menuId: menu.id,
      menuName: menu.name,
      unitPrice,
      quantity: reqItem.quantity,
      spiceLevel: menu.hasSpiceLevel ? reqItem.spiceLevel : null,
      notes: reqItem.notes,
      subtotal,
    });
  });

  if (validationErrors.length > 0) {
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      validationErrors[0].message,
      validationErrors
    );
  }

  return {
    items: calculatedItems,
    totalAmount,
  };
}

export class OrderService {
  /**
   * Creates a guest order transactionally after validating menu availability,
   * spice levels, and calculating authoritative server-side totals.
   */
  async createOrder(input: CreateOrderInput) {
    const uniqueMenuIds = Array.from(new Set(input.items.map((item) => item.menuId)));

    const { createdOrder, rawToken } = await prisma.$transaction(async (tx) => {
      const menus = await tx.menu.findMany({
        where: {
          id: { in: uniqueMenuIds },
        },
      });

      const menuMap = new Map<number, Menu>(menus.map((m) => [m.id, m]));

      // Validate items & compute authoritative prices
      const { items: calculatedItems, totalAmount } = calculateOrderPricing(
        input.items,
        menuMap
      );

      // Generate unique orderCode and tracking token capability
      const orderCode = await generateUniqueOrderCode(tx);
      const { rawToken: generatedRawToken, tokenHash } = generateTrackingToken();

      const order = await tx.order.create({
        data: {
          orderCode,
          trackingTokenHash: tokenHash,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          orderType: input.orderType,
          tableNumber: input.tableNumber,
          totalAmount,
          orderStatus: OrderStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.PENDING,
          notes: input.notes,
          items: {
            create: calculatedItems,
          },
          statusLogs: {
            create: {
              previousStatus: null,
              newStatus: OrderStatus.PENDING_PAYMENT,
              changedBy: 'CUSTOMER',
              reason: 'Order created via guest checkout',
            },
          },
        },
        include: {
          items: true,
        },
      });

      return { createdOrder: order, rawToken: generatedRawToken };
    });

    return {
      id: createdOrder.id,
      order_id: createdOrder.id,
      order_code: createdOrder.orderCode,
      customer_name: createdOrder.customerName,
      customer_phone: createdOrder.customerPhone,
      order_type: createdOrder.orderType,
      table_number: createdOrder.tableNumber,
      items: createdOrder.items.map((item) => ({
        id: item.id,
        menu_id: item.menuId,
        name: item.menuName,
        menu_name: item.menuName,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        spice_level: item.spiceLevel,
        notes: item.notes,
        subtotal: item.subtotal,
      })),
      total: createdOrder.totalAmount,
      total_amount: createdOrder.totalAmount,
      notes: createdOrder.notes,
      order_status: createdOrder.orderStatus,
      payment_status: createdOrder.paymentStatus,
      tracking_token: rawToken,
      created_at: createdOrder.createdAt.toISOString(),
      updated_at: createdOrder.updatedAt.toISOString(),
    };
  }

  /**
   * Track order by orderCode verified by customer's tracking token.
   * Throws 404 if order does not exist.
   * Throws 401 if tracking token is invalid.
   */
  async trackOrder(orderCode: string, trackingToken: string) {
    if (!orderCode || typeof orderCode !== 'string' || orderCode.trim() === '') {
      throw new AppError(400, 'BAD_REQUEST', 'Parameter orderCode diperlukan');
    }

    const trimmedOrderCode = orderCode.trim();

    const order = await prisma.order.findUnique({
      where: { orderCode: trimmedOrderCode },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', `Pesanan dengan kode ${trimmedOrderCode} tidak ditemukan`);
    }

    // Verifikasi tracking token via timing-safe comparison
    const hashedToken = crypto.createHash('sha256').update(trackingToken.trim()).digest('hex');
    const isHashMatch =
      hashedToken.length === order.trackingTokenHash.length &&
      crypto.timingSafeEqual(Buffer.from(hashedToken), Buffer.from(order.trackingTokenHash));
    const isDirectMatch =
      trackingToken.trim().length === order.trackingTokenHash.length &&
      crypto.timingSafeEqual(Buffer.from(trackingToken.trim()), Buffer.from(order.trackingTokenHash));

    if (!isHashMatch && !isDirectMatch) {
      throw new AppError(401, 'UNAUTHORIZED', 'Token pelacakan tidak valid');
    }

    return {
      id: order.id,
      orderCode: order.orderCode,
      order_code: order.orderCode,
      customerName: order.customerName,
      customer_name: order.customerName,
      orderType: order.orderType,
      order_type: order.orderType,
      tableNumber: order.tableNumber,
      table_number: order.tableNumber,
      totalPrice: order.totalAmount,
      totalAmount: order.totalAmount,
      total_amount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      payment_status: order.paymentStatus,
      orderStatus: order.orderStatus,
      order_status: order.orderStatus,
      status: mapOrderStatusToDisplay(order.orderStatus),
      display_status: mapOrderStatusToDisplay(order.orderStatus),
      items: order.items.map((item) => ({
        id: item.id,
        menuId: item.menuId,
        menuName: item.menuName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        spiceLevel: item.spiceLevel,
        notes: item.notes,
        subtotal: item.subtotal,
      })),
      createdAt: order.createdAt.toISOString(),
      created_at: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
    };
  }
}

export function mapOrderStatusToDisplay(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING_PAYMENT:
      return 'MENUNGGU_PEMBAYARAN';
    case OrderStatus.RECEIVED:
      return 'DITERIMA';
    case OrderStatus.PREPARING:
    case OrderStatus.READY:
      return 'DIPROSES';
    case OrderStatus.COMPLETED:
      return 'SELESAI';
    case OrderStatus.CANCELLED:
      return 'DIBATALKAN';
    default:
      return status;
  }
}

export const orderService = new OrderService();
