import { describe, it, expect, afterAll } from 'vitest';
import crypto from 'crypto';
import { OrderType, OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../src/config/prisma';

describe('Milestone 1: Order & OrderItem Database Schema and Seeder', () => {
  const createdOrderIds: number[] = [];
  const createdMenuIds: number[] = [];

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    if (createdMenuIds.length > 0) {
      await prisma.menu.deleteMany({
        where: { id: { in: createdMenuIds } },
      });
    }
    await prisma.$disconnect();
  });

  it('should verify seeded dummy orders (MVR-DUMMY01 and MVR-DUMMY02) exist with items and status logs', async () => {
    const dummyDineIn = await prisma.order.findUnique({
      where: { orderCode: 'MVR-DUMMY01' },
      include: {
        items: { include: { menu: true } },
        statusLogs: true,
      },
    });

    expect(dummyDineIn).not.toBeNull();
    expect(dummyDineIn?.orderType).toBe(OrderType.DINE_IN);
    expect(dummyDineIn?.tableNumber).toBe(4);
    expect(dummyDineIn?.orderStatus).toBe(OrderStatus.PENDING_PAYMENT);
    expect(dummyDineIn?.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(dummyDineIn?.trackingTokenHash).toHaveLength(64);
    expect(dummyDineIn?.items.length).toBeGreaterThanOrEqual(2);

    const calculatedTotal = dummyDineIn!.items.reduce((acc, item) => acc + item.subtotal, 0);
    expect(dummyDineIn?.totalAmount).toBe(calculatedTotal);
    expect(dummyDineIn?.statusLogs.length).toBeGreaterThanOrEqual(1);

    const dummyTakeaway = await prisma.order.findUnique({
      where: { orderCode: 'MVR-DUMMY02' },
      include: {
        items: true,
        statusLogs: true,
      },
    });

    expect(dummyTakeaway).not.toBeNull();
    expect(dummyTakeaway?.orderType).toBe(OrderType.TAKEAWAY);
    expect(dummyTakeaway?.tableNumber).toBeNull();
    expect(dummyTakeaway?.orderStatus).toBe(OrderStatus.RECEIVED);
    expect(dummyTakeaway?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(dummyTakeaway?.items.length).toBeGreaterThanOrEqual(1);
    expect(dummyTakeaway?.statusLogs.length).toBeGreaterThanOrEqual(2);
  });

  it('should persist Order and OrderItem records with relations to Menu, spiceLevel, and quantity', async () => {
    const menu = await prisma.menu.create({
      data: {
        name: `Test Geprek Schema ${Date.now()}`,
        price: 18000,
        category: 'Makanan',
        isAvailable: true,
        hasSpiceLevel: true,
      },
    });
    createdMenuIds.push(menu.id);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const orderCode = `MVR-TEST-${Date.now().toString().slice(-6)}`;

    const createdOrder = await prisma.order.create({
      data: {
        orderCode,
        trackingTokenHash: tokenHash,
        customerName: 'Andi Pratama',
        customerPhone: '081234567899',
        orderType: OrderType.DINE_IN,
        tableNumber: 7,
        totalAmount: 36000,
        orderStatus: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        items: {
          create: [
            {
              menuId: menu.id,
              menuName: menu.name,
              unitPrice: menu.price,
              quantity: 2,
              spiceLevel: 4,
              notes: 'Jangan terlalu berminyak',
              subtotal: menu.price * 2,
            },
          ],
        },
      },
      include: {
        items: {
          include: {
            menu: true,
          },
        },
      },
    });
    createdOrderIds.push(createdOrder.id);

    expect(createdOrder.orderCode).toBe(orderCode);
    expect(createdOrder.trackingTokenHash).toBe(tokenHash);
    expect(createdOrder.orderType).toBe(OrderType.DINE_IN);
    expect(createdOrder.tableNumber).toBe(7);
    expect(createdOrder.totalAmount).toBe(36000);
    expect(createdOrder.orderStatus).toBe(OrderStatus.PENDING_PAYMENT);
    expect(createdOrder.items).toHaveLength(1);

    const item = createdOrder.items[0];
    expect(item.menuId).toBe(menu.id);
    expect(item.menu?.name).toBe(menu.name);
    expect(item.quantity).toBe(2);
    expect(item.spiceLevel).toBe(4);
    expect(item.unitPrice).toBe(18000);
    expect(item.subtotal).toBe(36000);
  });

  it('should preserve OrderItem historical snapshot (onDelete: SetNull) if referenced Menu is deleted', async () => {
    const tempMenu = await prisma.menu.create({
      data: {
        name: `Temp Snapshot Menu ${Date.now()}`,
        price: 15000,
        category: 'Makanan',
        isAvailable: true,
        hasSpiceLevel: true,
      },
    });

    const orderCode = `MVR-SNAP-${Date.now().toString().slice(-6)}`;
    const order = await prisma.order.create({
      data: {
        orderCode,
        trackingTokenHash: crypto.randomBytes(32).toString('hex'),
        customerName: 'Snapshot Tester',
        customerPhone: '081111222333',
        orderType: OrderType.TAKEAWAY,
        tableNumber: null,
        totalAmount: 15000,
        items: {
          create: [
            {
              menuId: tempMenu.id,
              menuName: tempMenu.name,
              unitPrice: tempMenu.price,
              quantity: 1,
              spiceLevel: 2,
              subtotal: 15000,
            },
          ],
        },
      },
    });
    createdOrderIds.push(order.id);

    // Delete the menu row directly to verify SetNull behavior on OrderItem
    await prisma.menu.delete({ where: { id: tempMenu.id } });

    const reloadedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });

    expect(reloadedOrder).not.toBeNull();
    expect(reloadedOrder?.items).toHaveLength(1);
    expect(reloadedOrder?.items[0].menuId).toBeNull();
    expect(reloadedOrder?.items[0].menuName).toBe(tempMenu.name);
    expect(reloadedOrder?.items[0].unitPrice).toBe(15000);
  });
});
