import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCustomerNameSession,
  getCustomerName,
  saveCustomerName,
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

describe('one-hour customer name session', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = installStorage();
    storage.clear();
    clearCustomerNameSession();
  });

  it('restores a name within one hour and keeps the original expiry when edited', () => {
    saveCustomerName('Budi', 1_000);
    saveCustomerName('Budi Santoso', 2_000);

    expect(getCustomerName(3_599_999)).toBe('Budi Santoso');
    expect(getCustomerName(3_601_000)).toBeNull();
  });

  it('does not extend expiry when the page is refreshed', () => {
    saveCustomerName('Siti', 10_000);

    expect(getCustomerName(10_000 + 60 * 60 * 1000 - 1)).toBe('Siti');
    expect(getCustomerName(10_000 + 60 * 60 * 1000)).toBeNull();
  });

  it('clears malformed session data', () => {
    storage.setItem('pos_mavera_customer_name_v1', '{"name":42}');

    expect(getCustomerName(1_000)).toBeNull();
    expect(storage.getItem('pos_mavera_customer_name_v1')).toBeNull();
  });

  it('continues working with an in-memory fallback when storage is unavailable', () => {
    saveCustomerName('Fallback', 20_000);
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

    expect(getCustomerName(20_001)).toBe('Fallback');
  });
});
