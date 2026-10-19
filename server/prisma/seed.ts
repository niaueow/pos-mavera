import { PrismaClient, OrderType, OrderStatus, PaymentStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const prisma = new PrismaClient();

interface MenuSeedItem {
  name: string;
  category: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  hasSpiceLevel: boolean;
  sortOrder: number;
}

export async function seed(): Promise<void> {
  // Safety check: Never run seed in production
  if (process.env.NODE_ENV === 'production') {
    console.error('⛔ Refusing to run development seed in production environment!');
    process.exit(1);
  }

  console.log('🌱 Starting POS Mavera database seeding...');

  // 1. Locate and read menu.xlsx
  const excelPath = path.resolve(__dirname, 'menu.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Source of truth menu file not found at: ${excelPath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(excelPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    console.error('❌ Worksheet 1 not found in menu.xlsx');
    process.exit(1);
  }

  const validItems: MenuSeedItem[] = [];
  const skippedRows: { rowNumber: number; reason: string }[] = [];
  let rowsRead = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    rowsRead++;

    const values = row.values as unknown[];
    const rawName = values[1];
    const rawCategory = values[2];
    const rawPrice = values[3];
    const rawDescription = values[4];
    const rawImageUrl = values[5];
    const rawIsAvailable = values[6];
    const rawHasSpiceLevel = values[7];
    const rawSortOrder = values[8];

    // Validation
    if (!rawName || typeof rawName !== 'string' || rawName.trim().length === 0) {
      skippedRows.push({ rowNumber, reason: 'Missing or invalid item name' });
      return;
    }

    if (!rawCategory || typeof rawCategory !== 'string' || rawCategory.trim().length === 0) {
      skippedRows.push({ rowNumber, reason: `Missing category for '${rawName}'` });
      return;
    }

    const price = Number(rawPrice);
    if (isNaN(price) || price <= 0 || !Number.isInteger(price)) {
      skippedRows.push({ rowNumber, reason: `Invalid IDR price '${rawPrice}' for '${rawName}'` });
      return;
    }

    const isAvailable = rawIsAvailable === true || rawIsAvailable === 'TRUE' || rawIsAvailable === 1;
    const hasSpiceLevel = rawHasSpiceLevel === true || rawHasSpiceLevel === 'TRUE' || rawHasSpiceLevel === 1;
    const sortOrder = typeof rawSortOrder === 'number' ? rawSortOrder : rowsRead;

    validItems.push({
      name: rawName.trim(),
      category: rawCategory.trim(),
      price,
      description: rawDescription ? String(rawDescription).trim() : null,
      imageUrl: rawImageUrl ? String(rawImageUrl).trim() : null,
      isAvailable,
      hasSpiceLevel,
      sortOrder,
    });
  });

  console.log(`📊 Excel Read Summary:`);
  console.log(`   - Total data rows read: ${rowsRead}`);
  console.log(`   - Valid rows to seed: ${validItems.length}`);
  console.log(`   - Skipped rows: ${skippedRows.length}`);
  if (skippedRows.length > 0) {
    console.warn('   - Skipped details:', skippedRows);
  }

  // 2. Idempotent Upsert for Menu Items
  let seededMenuCount = 0;
  for (const item of validItems) {
    await prisma.menu.upsert({
      where: { name: item.name },
      update: {
        price: item.price,
        category: item.category,
        description: item.description,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
        hasSpiceLevel: item.hasSpiceLevel,
        sortOrder: item.sortOrder,
        isDeleted: false,
      },
      create: {
        name: item.name,
        price: item.price,
        category: item.category,
        description: item.description,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
        hasSpiceLevel: item.hasSpiceLevel,
        sortOrder: item.sortOrder,
      },
    });
    seededMenuCount++;
  }
  console.log(`✅ Menu items seeded/upserted: ${seededMenuCount}`);

  // 3. Idempotent Seed for Initial Staff & Admin Accounts
  const staffEmail = process.env.INITIAL_STAFF_EMAIL || 'staff@mavera.local';
  const staffPassword = process.env.INITIAL_STAFF_PASSWORD || 'StaffMavera123!';
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@mavera.local';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'AdminMavera123!';

  const staffPasswordHash = await bcrypt.hash(staffPassword, 10);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const staffUser = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {
      isActive: true,
      role: 'STAFF',
    },
    create: {
      name: 'Kitchen Staff',
      email: staffEmail,
      passwordHash: staffPasswordHash,
      role: 'STAFF',
      isActive: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      isActive: true,
      role: 'ADMIN',
    },
    create: {
      name: 'Manager Admin',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`✅ Operational users seeded:`);
  console.log(`   - Staff: ${staffUser.email} (Role: ${staffUser.role})`);
  console.log(`   - Admin: ${adminUser.email} (Role: ${adminUser.role})`);

  // 4. Idempotent Seed for Dummy Orders (for initial API testing)
  const availableMenus = await prisma.menu.findMany({
    where: { isAvailable: true, isDeleted: false },
    orderBy: { sortOrder: 'asc' },
  });

  const spicyMenu = availableMenus.find((m) => m.hasSpiceLevel) || availableMenus[0];
  const nonSpicyMenu = availableMenus.find((m) => !m.hasSpiceLevel) || availableMenus[1] || availableMenus[0];

  if (spicyMenu && nonSpicyMenu) {
    const dummyOrders = [
      {
        orderCode: 'MVR-DUMMY01',
        rawTrackingToken: 'dummy-tracking-token-order-01-a1b2c3d4e5f60123456789abcdef012345',
        customerName: 'Budi Santoso',
        customerPhone: '081234567890',
        orderType: OrderType.DINE_IN,
        tableNumber: 4,
        orderStatus: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        notes: 'Sambal dipisah untuk 1 porsi',
        items: [
          {
            menuId: spicyMenu.id,
            menuName: spicyMenu.name,
            unitPrice: spicyMenu.price,
            quantity: 2,
            spiceLevel: spicyMenu.hasSpiceLevel ? 3 : null,
            notes: 'Pedas sedang',
            subtotal: spicyMenu.price * 2,
          },
          {
            menuId: nonSpicyMenu.id,
            menuName: nonSpicyMenu.name,
            unitPrice: nonSpicyMenu.price,
            quantity: 2,
            spiceLevel: null,
            notes: 'Es sedikit',
            subtotal: nonSpicyMenu.price * 2,
          },
        ],
        statusLogs: [
          {
            previousStatus: null,
            newStatus: OrderStatus.PENDING_PAYMENT,
            changedBy: 'CUSTOMER',
            reason: 'Initial dummy dine-in order created via seed',
          },
        ],
      },
      {
        orderCode: 'MVR-DUMMY02',
        rawTrackingToken: 'dummy-tracking-token-order-02-f6e5d4c3b2a10123456789abcdef012345',
        customerName: 'Siti Aminah',
        customerPhone: '081298765432',
        orderType: OrderType.TAKEAWAY,
        tableNumber: null,
        orderStatus: OrderStatus.RECEIVED,
        paymentStatus: PaymentStatus.PAID,
        notes: 'Bungkus rapi, tambah sendok plastik',
        items: [
          {
            menuId: spicyMenu.id,
            menuName: spicyMenu.name,
            unitPrice: spicyMenu.price,
            quantity: 1,
            spiceLevel: spicyMenu.hasSpiceLevel ? 5 : null,
            notes: 'Extra pedas',
            subtotal: spicyMenu.price * 1,
          },
        ],
        statusLogs: [
          {
            previousStatus: null,
            newStatus: OrderStatus.PENDING_PAYMENT,
            changedBy: 'CUSTOMER',
            reason: 'Initial dummy takeaway order created via seed',
          },
          {
            previousStatus: OrderStatus.PENDING_PAYMENT,
            newStatus: OrderStatus.RECEIVED,
            changedBy: 'SYSTEM',
            reason: 'Dummy payment settled',
          },
        ],
      },
    ];

    for (const dummy of dummyOrders) {
      const trackingTokenHash = crypto
        .createHash('sha256')
        .update(dummy.rawTrackingToken)
        .digest('hex');
      const totalAmount = dummy.items.reduce((sum, item) => sum + item.subtotal, 0);

      await prisma.$transaction(async (tx) => {
        // Remove existing dummy order by orderCode if present so items & logs are cleanly recreated
        await tx.order.deleteMany({
          where: { orderCode: dummy.orderCode },
        });

        await tx.order.create({
          data: {
            orderCode: dummy.orderCode,
            trackingTokenHash,
            customerName: dummy.customerName,
            customerPhone: dummy.customerPhone,
            orderType: dummy.orderType,
            tableNumber: dummy.tableNumber,
            totalAmount,
            orderStatus: dummy.orderStatus,
            paymentStatus: dummy.paymentStatus,
            notes: dummy.notes,
            items: {
              create: dummy.items,
            },
            statusLogs: {
              create: dummy.statusLogs,
            },
          },
        });
      });
    }

    console.log(`✅ Dummy orders seeded: ${dummyOrders.length}`);
    for (const dummy of dummyOrders) {
      console.log(
        `   - ${dummy.orderCode} (${dummy.orderType}, status: ${dummy.orderStatus}, payment: ${dummy.paymentStatus}) | Test Token: ${dummy.rawTrackingToken}`
      );
    }
  }

  console.log('🎉 Database seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

