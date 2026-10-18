import { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/errorHandler';

const VALID_STAFF_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: [OrderStatus.PREPARING],
  PREPARING: [OrderStatus.READY],
  READY: [OrderStatus.COMPLETED],
  PENDING_PAYMENT: [], // Cannot be moved by staff directly
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

export class OrderStatusService {
  /**
   * Get active orders for internal kitchen / staff dashboard
   */
  async getActiveOrders(statusFilter?: OrderStatus) {
    const where: Prisma.OrderWhereInput = {};

    if (statusFilter) {
      where.orderStatus = statusFilter;
    } else {
      // By default, return orders currently in the active kitchen pipeline
      where.orderStatus = {
        in: [OrderStatus.RECEIVED, OrderStatus.PREPARING, OrderStatus.READY],
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
      order_code: order.orderCode,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      order_type: order.orderType,
      table_number: order.tableNumber,
      total_amount: order.totalAmount,
      order_status: order.orderStatus,
      payment_status: order.paymentStatus,
      notes: order.notes,
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        menu_id: item.menuId,
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

    // Rule: Cannot move unpaid orders into preparation
    if (order.paymentStatus !== 'PAID') {
      throw new AppError(
        422,
        'UNPAID_ORDER',
        'Pesanan belum dibayar dan tidak dapat diproses ke dapur'
      );
    }

    // Rule: Cannot advance from terminal state
    if (order.orderStatus === OrderStatus.COMPLETED || order.orderStatus === OrderStatus.CANCELLED) {
      throw new AppError(
        409,
        'TERMINAL_STATE',
        `Pesanan sudah berstatus terminal (${order.orderStatus}) dan tidak dapat diubah lagi`
      );
    }

    // Rule: Duplicate status transition produces conflict
    if (order.orderStatus === targetStatus) {
      throw new AppError(
        409,
        'DUPLICATE_STATUS',
        `Pesanan sudah berada pada status ${targetStatus}`
      );
    }

    // Rule: Validate sequential one-step transition
    const allowedTargets = VALID_STAFF_TRANSITIONS[order.orderStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      throw new AppError(
        409,
        'INVALID_STATE_TRANSITION',
        `Transisi status dari ${order.orderStatus} ke ${targetStatus} tidak diizinkan`
      );
    }

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
