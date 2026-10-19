
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load local env files as fallback.
// An explicitly supplied DATABASE_URL takes precedence.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const excelPath = path.resolve(__dirname, 'menu.xlsx');

  if (!fs.existsSync(excelPath)) {
    throw new Error(`Menu Excel file not found: ${excelPath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fs.readFileSync(excelPath));

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('Worksheet 1 not found in menu.xlsx');
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const name = row.getCell(1).text.trim();
    const category = row.getCell(2).text.trim();
    const rawPrice = row.getCell(3).value;
    const description = row.getCell(4).text.trim();
    const imageUrl = row.getCell(5).text.trim();
    const rawAvailable = row.getCell(6).value;
    const rawSpice = row.getCell(7).value;
    const rawSortOrder = row.getCell(8).value;

    if (!name && !category && !rawPrice) continue;

    const price = Number(
      typeof rawPrice === 'object' && rawPrice !== null && 'result' in rawPrice
        ? rawPrice.result
        : rawPrice
    );

    if (!name || !category || !Number.isInteger(price) || price <= 0) {
      console.warn(`Skipping invalid Excel row ${rowNumber}`);
      skipped++;
      continue;
    }

    const isAvailable =
      rawAvailable === true ||
      String(rawAvailable).toUpperCase() === 'TRUE' ||
      rawAvailable === 1;

    const hasSpiceLevel =
      rawSpice === true ||
      String(rawSpice).toUpperCase() === 'TRUE' ||
      rawSpice === 1;

    const sortOrder =
      typeof rawSortOrder === 'number' ? rawSortOrder : rowNumber - 1;

    const existing = await prisma.menu.findUnique({ where: { name } });

    await prisma.menu.upsert({
      where: { name },
      update: {
        category,
        price,
        description: description || null,
        imageUrl: imageUrl || null,
        isAvailable,
        hasSpiceLevel,
        sortOrder,
        isDeleted: false,
      },
      create: {
        name,
        category,
        price,
        description: description || null,
        imageUrl: imageUrl || null,
        isAvailable,
        hasSpiceLevel,
        sortOrder,
      },
    });

    if (existing) updated++;
    else created++;
  }

  console.log('Menu import completed.');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error('Menu import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
