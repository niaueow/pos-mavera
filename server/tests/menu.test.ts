import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { menuService } from '../src/services/menu.service';

describe('Public Menu API (GET /api/v1/menus)', () => {
  let app: Application;
  let unavailableMenuId: number;
  let softDeletedMenuId: number;

  beforeAll(async () => {
    app = createApp();

    // Create a temporary unavailable item and a soft-deleted item to verify filtering rules
    const unavailableItem = await prisma.menu.create({
      data: {
        name: 'Test Menu Unavailable Item ' + Date.now(),
        price: 15000,
        category: 'Test Category',
        isAvailable: false,
        isDeleted: false,
        hasSpiceLevel: false,
      },
    });
    unavailableMenuId = unavailableItem.id;

    const softDeletedItem = await prisma.menu.create({
      data: {
        name: 'Test Menu Soft Deleted Item ' + Date.now(),
        price: 12000,
        category: 'Test Category',
        isAvailable: true,
        isDeleted: true,
        hasSpiceLevel: false,
      },
    });
    softDeletedMenuId = softDeletedItem.id;
  });

  afterAll(async () => {
    // Cleanup temporary test items
    if (unavailableMenuId) {
      await prisma.menu.delete({ where: { id: unavailableMenuId } }).catch(() => {});
    }
    if (softDeletedMenuId) {
      await prisma.menu.delete({ where: { id: softDeletedMenuId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('GET /api/v1/menus should return 200 and list only active, non-deleted menus', async () => {
    const res = await request(app).get('/api/v1/menus');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Menus retrieved successfully');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    // Verify response structure and data types
    const firstItem = res.body.data[0];
    expect(firstItem).toHaveProperty('id');
    expect(typeof firstItem.id).toBe('number');
    expect(firstItem).toHaveProperty('name');
    expect(typeof firstItem.name).toBe('string');
    expect(firstItem).toHaveProperty('price');
    expect(typeof firstItem.price).toBe('number');
    expect(Number.isInteger(firstItem.price)).toBe(true);
    expect(firstItem).toHaveProperty('category');
    expect(firstItem).toHaveProperty('description');
    expect(firstItem).toHaveProperty('image_url');
    expect(firstItem).toHaveProperty('is_available');
    expect(firstItem.is_available).toBe(true);
    expect(firstItem).toHaveProperty('has_spice_level');
    expect(typeof firstItem.has_spice_level).toBe('boolean');

    // Neither unavailable nor soft-deleted items should appear in the public list
    const ids = res.body.data.map((item: { id: number }) => item.id);
    expect(ids).not.toContain(unavailableMenuId);
    expect(ids).not.toContain(softDeletedMenuId);

    // No internal fields like is_deleted or createdAt/updatedAt should leak
    expect(firstItem.is_deleted).toBeUndefined();
    expect(firstItem.isDeleted).toBeUndefined();
  });

  it('GET /api/v1/menus?search=Paket should perform case-insensitive name/description search', async () => {
    const res = await request(app).get('/api/v1/menus?search=paket');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((item: { name: string; description: string | null }) => {
      const matchName = item.name.toLowerCase().includes('paket');
      const matchDesc = item.description?.toLowerCase().includes('paket') ?? false;
      expect(matchName || matchDesc).toBe(true);
    });
  });

  it('GET /api/v1/menus?q=  Geprek   should accept alias q and trim surrounding whitespace', async () => {
    const res = await request(app).get('/api/v1/menus?q=%20%20Geprek%20%20');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((item: { name: string }) => {
      expect(item.name.toLowerCase()).toContain('geprek');
    });
  });

  it('GET /api/v1/menus?category=Minuman should filter items by category', async () => {
    const res = await request(app).get('/api/v1/menus?category=Minuman');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((item: { category: string }) => {
      expect(item.category.toLowerCase()).toBe('minuman');
    });
  });

  it('GET /api/v1/menus with pagination parameters should return pagination meta', async () => {
    const res = await request(app).get('/api/v1/menus?page=1&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(5);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(5);
    expect(res.body.meta.total_items).toBeGreaterThanOrEqual(35);
    expect(res.body.meta.total_pages).toBeGreaterThanOrEqual(7);
  });

  it('GET /api/v1/menus with non-matching search should return empty array (not 404)', async () => {
    const res = await request(app).get('/api/v1/menus?search=ItemYangPastiTidakAdaDiMenu12345');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/v1/menus with invalid query parameters should return 422 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/v1/menus?page=-1');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
    expect(res.body.error.details.some((d: { field: string }) => d.field === 'page')).toBe(true);
  });

  it('GET /api/v1/menus with limit exceeding 100 should return 422 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/v1/menus?limit=101');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((d: { field: string }) => d.field === 'limit')).toBe(true);
  });

  it('GET /api/v1/menus/:id should return details for an existing available menu', async () => {
    // Pick an existing item
    const all = await request(app).get('/api/v1/menus?limit=1');
    const existingId = all.body.data[0].id;

    const res = await request(app).get(`/api/v1/menus/${existingId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(existingId);
    expect(res.body.data.is_available).toBe(true);
    expect(res.body.data.available).toBe(true);
  });

  it('GET /api/v1/menus/:id for unavailable or soft-deleted menu should return 404 NOT_FOUND', async () => {
    const resUnavailable = await request(app).get(`/api/v1/menus/${unavailableMenuId}`);
    expect(resUnavailable.status).toBe(404);
    expect(resUnavailable.body.success).toBe(false);
    expect(resUnavailable.body.error.code).toBe('NOT_FOUND');

    const resSoftDeleted = await request(app).get(`/api/v1/menus/${softDeletedMenuId}`);
    expect(resSoftDeleted.status).toBe(404);
    expect(resSoftDeleted.body.success).toBe(false);
    expect(resSoftDeleted.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/menus/:id with invalid ID parameter should return 422 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/v1/menus/invalid-id');
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/menus should return 500 INTERNAL_ERROR when database/service fails', async () => {
    const originalMethod = menuService.getPublicMenus;
    // Simulate service/database failure
    menuService.getPublicMenus = async () => {
      throw new Error('Database connection failure');
    };

    try {
      const res = await request(app).get('/api/v1/menus');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    } finally {
      // Restore original method
      menuService.getPublicMenus = originalMethod;
    }
  });
});
