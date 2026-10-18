import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
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
