import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCustomerNameSession,
  getCustomerSession,
  saveCustomerSession,
} from '../services/customerSession';

interface TestStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

function installStorage(): TestStorage {
  const values = new Map<string, string>();
  const storage: TestStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: storage,
  });
  return storage;
}

describe('one-hour customer session', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = installStorage();
    storage.clear();
    clearCustomerNameSession();
  });

  it('restores name and phone within one hour and keeps the original expiry when edited', () => {
    saveCustomerSession('Budi', '081234567890', 1_000);
    saveCustomerSession('Budi Santoso', '089876543210', 2_000);

    expect(getCustomerSession(3_599_999)).toMatchObject({
      name: 'Budi Santoso',
      phone: '089876543210',
      createdAt: 1_000,
      expiresAt: 3_601_000,
    });
    expect(getCustomerSession(3_601_000)).toBeNull();
  });

  it('does not extend expiry when the page is refreshed', () => {
    saveCustomerSession('Siti', '081234567890', 10_000);

    expect(getCustomerSession(10_000 + 60 * 60 * 1000 - 1)?.phone).toBe('081234567890');
    expect(getCustomerSession(10_000 + 60 * 60 * 1000)).toBeNull();
  });

  it('updates either field without resetting the existing expiry', () => {
    saveCustomerSession('Dewi', '081234567890', 30_000);
    saveCustomerSession('Dewi', '089876543210', 31_000);

    expect(getCustomerSession(30_000 + 60 * 60 * 1000 - 1)).toMatchObject({
      name: 'Dewi',
      phone: '089876543210',
    });
  });

  it('clears malformed session data', () => {
    storage.setItem('pos_mavera_customer_name_v1', '{"name":"Budi"}');

    expect(getCustomerSession(1_000)).toBeNull();
    expect(storage.getItem('pos_mavera_customer_name_v1')).toBeNull();
  });

  it('continues working with an in-memory fallback when storage is unavailable', () => {
    saveCustomerSession('Fallback', '081234567890', 20_000);
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('storage unavailable');
        },
        setItem: () => {
          throw new Error('storage unavailable');
        },
        removeItem: () => {
          throw new Error('storage unavailable');
        },
      },
    });

    expect(getCustomerSession(20_001)).toMatchObject({
      name: 'Fallback',
      phone: '081234567890',
    });
  });
});
