const CUSTOMER_NAME_SESSION_KEY = 'pos_mavera_customer_name_v1';
const CUSTOMER_NAME_SESSION_DURATION_MS = 60 * 60 * 1000;

interface CustomerNameSession {
  name: string;
  createdAt: number;
  expiresAt: number;
}

let customerNameFallback: CustomerNameSession | null = null;

function readStoredSession(): CustomerNameSession | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(CUSTOMER_NAME_SESSION_KEY);
  } catch {
    return customerNameFallback;
  }

  if (!raw) return customerNameFallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as CustomerNameSession).name === 'string' &&
      (parsed as CustomerNameSession).name.trim() !== '' &&
      Number.isFinite((parsed as CustomerNameSession).createdAt) &&
      Number.isFinite((parsed as CustomerNameSession).expiresAt)
    ) {
      return {
        name: (parsed as CustomerNameSession).name,
        createdAt: (parsed as CustomerNameSession).createdAt,
        expiresAt: (parsed as CustomerNameSession).expiresAt,
      };
    }
  } catch {
    // Remove malformed data below.
  }

  try {
    sessionStorage.removeItem(CUSTOMER_NAME_SESSION_KEY);
  } catch {
    // Ignore unavailable storage.
  }
  customerNameFallback = null;
  return null;
}

function writeSession(value: CustomerNameSession | null): void {
  customerNameFallback = value;
  try {
    if (value) {
      sessionStorage.setItem(CUSTOMER_NAME_SESSION_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(CUSTOMER_NAME_SESSION_KEY);
    }
  } catch {
    // In-memory fallback remains available for this page session.
  }
}

export function getCustomerName(now = Date.now()): string | null {
  const stored = readStoredSession();
  if (!stored) return null;
  if (stored.expiresAt <= now || stored.createdAt > stored.expiresAt) {
    writeSession(null);
    return null;
  }
  return stored.name;
}

export function saveCustomerName(name: string, now = Date.now()): void {
  const trimmedName = name.trim();
  if (!trimmedName) {
    writeSession(null);
    return;
  }

  const existing = readStoredSession();
  const session =
    existing && existing.expiresAt > now && existing.createdAt <= existing.expiresAt
      ? { ...existing, name: trimmedName }
      : {
          name: trimmedName,
          createdAt: now,
          expiresAt: now + CUSTOMER_NAME_SESSION_DURATION_MS,
        };
  writeSession(session);
}

export function clearCustomerNameSession(): void {
  writeSession(null);
}
