import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLatestOrderReference,
  getLatestOrderReference,
  saveLatestOrderReference,
} from '../services/orderService';

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

describe('latest order reference', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = installStorage();
    storage.clear();
    clearLatestOrderReference();
  });

  it('persists and restores the latest order reference from sessionStorage', () => {
    saveLatestOrderReference('MVR-FIRST', 'token-first');

    expect(getLatestOrderReference()).toMatchObject({
      orderCode: 'MVR-FIRST',
      trackingToken: 'token-first',
    });
    expect(JSON.parse(storage.getItem('pos_mavera_last_order_v1') ?? '{}')).toEqual(
      expect.objectContaining({
        orderCode: 'MVR-FIRST',
        trackingToken: 'token-first',
      })
    );
  });

  it('replaces the reference when a new order is created', () => {
    saveLatestOrderReference('MVR-FIRST', 'token-first');
    saveLatestOrderReference('MVR-SECOND', 'token-second');

    expect(getLatestOrderReference()?.orderCode).toBe('MVR-SECOND');
    expect(getLatestOrderReference()?.trackingToken).toBe('token-second');
  });

  it('clears malformed references instead of using an untrusted token', () => {
    storage.setItem('pos_mavera_last_order_v1', '{"orderCode":"MVR-BROKEN"}');

    expect(getLatestOrderReference()).toBeNull();
    expect(storage.getItem('pos_mavera_last_order_v1')).toBeNull();
  });

  it('returns an empty state when no order reference exists', () => {
    expect(getLatestOrderReference()).toBeNull();
  });
});
