import { Order, OrderStatus, OrderType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/errorHandler';

export const VALID_STAFF_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: [OrderStatus.PREPARING], // Pesanan Diterima -> Sedang Dimasak
  PREPARING: [OrderStatus.READY], // Sedang Dimasak -> Pesanan Siap Diambil
  READY: [OrderStatus.COMPLETED], // Pesanan Siap Diambil -> Selesai
  PENDING_PAYMENT: [], // Cannot be moved by staff directly
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

export interface GetActiveOrdersOptions {
  status?: OrderStatus;
  today?: boolean;
  order_type?: OrderType;
}

/**
 * Validates whether an order can transition from its current status to targetStatus.
 * Enforces payment status check, terminal state guard, duplicate status check,
 * and strict forward-only single-step transition rules.
 */
export function assertValidOrderStatusTransition(
  order: Pick<Order, 'id' | 'orderStatus' | 'paymentStatus'>,
  targetStatus: OrderStatus
): void {
  // Rule 1: Cannot move unpaid orders into preparation/fulfillment
  if (order.paymentStatus !== 'PAID') {
    throw new AppError(
      422,
      'UNPAID_ORDER',
      'Pesanan belum dibayar dan tidak dapat diproses ke dapur'
    );
  }

  // Rule 2: Cannot advance from terminal state
  if (
    order.orderStatus === OrderStatus.COMPLETED ||
    order.orderStatus === OrderStatus.CANCELLED
  ) {
    throw new AppError(
      409,
      'TERMINAL_STATE',
      `Pesanan sudah berstatus terminal (${order.orderStatus}) dan tidak dapat diubah lagi`
    );
  }

  // Rule 3: Duplicate status transition produces conflict
  if (order.orderStatus === targetStatus) {
    throw new AppError(
      409,
      'DUPLICATE_STATUS',
      `Pesanan sudah berada pada status ${targetStatus}`
    );
  }

  // Rule 4: Validate sequential forward-only one-step transition (no backward or skipped steps)
  const allowedTargets = VALID_STAFF_TRANSITIONS[order.orderStatus] || [];
  if (!allowedTargets.includes(targetStatus)) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      `Transisi status dari ${order.orderStatus} ke ${targetStatus} tidak diizinkan`
    );
  }
}

export class OrderStatusService {
  /**
   * Get active orders for internal kitchen / staff dashboard
   */
  async getActiveOrders(filter?: OrderStatus | GetActiveOrdersOptions) {
    const options: GetActiveOrdersOptions =
      typeof filter === 'string' ? { status: filter } : filter || {};

    const where: Prisma.OrderWhereInput = {};

    if (options.status) {
      where.orderStatus = options.status;
    } else {
      // By default, return orders currently in the active kitchen pipeline (unfinished)
      where.orderStatus = {
        in: [OrderStatus.RECEIVED, OrderStatus.PREPARING, OrderStatus.READY],
      };
    }

    if (options.order_type) {
      where.orderType = options.order_type;
    }

    if (options.today) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'asc', // FIFO (First In First Out)
      },
    });

    return orders.map((order) => ({
      id: order.id,
      order_id: order.id,
      order_code: order.orderCode,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      order_type: order.orderType,
      table_number: order.tableNumber,
      total: order.totalAmount,
      total_amount: order.totalAmount,
      order_status: order.orderStatus,
      payment_status: order.paymentStatus,
      notes: order.notes,
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
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
    }));
  }

  /**
   * Get detailed order information including items and status logs by order ID
   */
  async getOrderById(orderId: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        statusLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', `Pesanan dengan ID ${orderId} tidak ditemukan`);
    }

    return {
      id: order.id,
      order_id: order.id,
      order_code: order.orderCode,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      order_type: order.orderType,
      table_number: order.tableNumber,
      total: order.totalAmount,
      total_amount: order.totalAmount,
      order_status: order.orderStatus,
      payment_status: order.paymentStatus,
      notes: order.notes,
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
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
      status_logs: order.statusLogs.map((log) => ({
        id: log.id,
        previous_status: log.previousStatus,
        new_status: log.newStatus,
        changed_by: log.changedBy,
        reason: log.reason,
        created_at: log.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Advance order status using strictly validated state transitions
   */
  async updateOrderStatus(
    orderId: number,
    targetStatus: OrderStatus,
    changedBy: string,
    reason?: string
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', `Pesanan dengan ID ${orderId} tidak ditemukan`);
    }

    assertValidOrderStatusTransition(order, targetStatus);

    // Transactionally update Order and insert OrderStatusLog
    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          orderStatus: targetStatus,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          previousStatus: order.orderStatus,
          newStatus: targetStatus,
          changedBy,
          reason,
        },
      });

      return updatedOrder;
    });

    return {
      order_id: updated.id,
      order_code: updated.orderCode,
      order_status: updated.orderStatus,
      updated_at: updated.updatedAt.toISOString(),
    };
  }
}

export const orderStatusService = new OrderStatusService();

