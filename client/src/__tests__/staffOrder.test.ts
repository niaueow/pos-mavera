import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOrderStatusMeta,
  formatTableLabel,
  formatRelativeMinutes,
  getActiveOrders,
  getOrderById,
  updateOrderStatus,
} from '../services/internalOrderService';
import * as apiClient from '../services/apiClient';

describe('Milestone 5: Staff Operational UI Logic & API Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dynamic Status Button & Badge Configuration (getOrderStatusMeta)', () => {
    it('should return "Proses Makanan" -> PREPARING when current status is RECEIVED ("Diterima")', () => {
      const meta = getOrderStatusMeta('RECEIVED');
      expect(meta.label).toBe('Diterima');
      expect(meta.nextStatus).toBe('PREPARING');
      expect(meta.nextLabel).toBe('Proses Makanan');
    });

    it('should return "Siap Diambil" -> READY when current status is PREPARING ("Sedang Dimasak")', () => {
      const meta = getOrderStatusMeta('PREPARING');
      expect(meta.label).toBe('Sedang Dimasak');
      expect(meta.nextStatus).toBe('READY');
      expect(meta.nextLabel).toBe('Siap Diambil');
    });

    it('should return "Tandai Selesai" -> COMPLETED when current status is READY ("Siap Diambil")', () => {
      const meta = getOrderStatusMeta('READY');
      expect(meta.label).toBe('Siap Diambil');
      expect(meta.nextStatus).toBe('COMPLETED');
      expect(meta.nextLabel).toBe('Tandai Selesai');
    });

    it('should return null nextStatus and nextLabel when order is COMPLETED', () => {
      const meta = getOrderStatusMeta('COMPLETED');
      expect(meta.label).toBe('Selesai');
      expect(meta.nextStatus).toBeNull();
      expect(meta.nextLabel).toBeNull();
    });
  });

  describe('Order Card Table & Order Type Formatting (formatTableLabel)', () => {
    it('should format single-digit dine-in table numbers with leading zero (e.g. Meja 08)', () => {
      expect(formatTableLabel('DINE_IN', 8)).toBe('Meja 08');
      expect(formatTableLabel('DINE_IN', 5)).toBe('Meja 05');
      expect(formatTableLabel('DINE_IN', 10)).toBe('Meja 10');
    });

    it('should return "Takeaway" for TAKEAWAY orders', () => {
      expect(formatTableLabel('TAKEAWAY', null)).toBe('Takeaway');
    });
  });

  describe('Elapsed Time & Urgency Indicator (formatRelativeMinutes)', () => {
    it('should format elapsed minutes and assign appropriate urgency colors', () => {
      const now = new Date('2026-10-19T14:40:00Z').getTime();

      const twoMinAgo = new Date('2026-10-19T14:38:00Z').toISOString();
      const res2 = formatRelativeMinutes(twoMinAgo, now);
      expect(res2.text).toBe('2 mnt lalu');
      expect(res2.minutes).toBe(2);
      expect(res2.urgencyClass).toContain('text-ink-muted');

      const twelveMinAgo = new Date('2026-10-19T14:28:00Z').toISOString();
      const res12 = formatRelativeMinutes(twelveMinAgo, now);
      expect(res12.text).toBe('12 mnt lalu');
      expect(res12.urgencyClass).toContain('font-bold');

      const twentyTwoMinAgo = new Date('2026-10-19T14:18:00Z').toISOString();
      const res22 = formatRelativeMinutes(twentyTwoMinAgo, now);
      expect(res22.text).toBe('22 mnt lalu');
      expect(res22.urgencyClass).toContain('text-danger');
    });
  });

  describe('Staff Operational API Integration (GET & PATCH /api/v1/staff/orders)', () => {
    it('getActiveOrders should call GET staff/orders with Bearer token', async () => {
      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValueOnce({
        success: true,
        message: 'Pesanan aktif berhasil diambil',
        data: [],
      });

      await getActiveOrders('test-jwt-token');
      expect(spy).toHaveBeenCalledWith('staff/orders', {
        headers: { Authorization: 'Bearer test-jwt-token' },
      });
    });

    it('getOrderById should call GET staff/orders/:id with Bearer token', async () => {
      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValueOnce({
        success: true,
        message: 'Detail pesanan berhasil diambil',
        data: { id: 42, order_code: 'MVR-2026-1002' },
      });

      await getOrderById('test-jwt-token', 42);
      expect(spy).toHaveBeenCalledWith('staff/orders/42', {
        headers: { Authorization: 'Bearer test-jwt-token' },
      });
    });

    it('updateOrderStatus should call PATCH staff/orders/:id/status with status payload', async () => {
      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValueOnce({
        success: true,
        message: 'Status pesanan berhasil diperbarui',
        data: {
          order_id: 42,
          order_code: 'MVR-2026-1002',
          order_status: 'READY',
          updated_at: new Date().toISOString(),
        },
      });

      await updateOrderStatus('test-jwt-token', 42, 'READY');
      expect(spy).toHaveBeenCalledWith('staff/orders/42/status', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer test-jwt-token' },
        body: JSON.stringify({ status: 'READY' }),
      });
    });
  });
});
