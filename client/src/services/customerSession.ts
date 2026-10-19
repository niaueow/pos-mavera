const CUSTOMER_SESSION_KEY = 'pos_mavera_customer_name_v1';
const CUSTOMER_NAME_SESSION_DURATION_MS = 60 * 60 * 1000;

export interface CustomerSession {
  name: string;
  phone: string;
  createdAt: number;
  expiresAt: number;
}

let customerSessionFallback: CustomerSession | null = null;

function readStoredSession(): CustomerSession | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(CUSTOMER_SESSION_KEY);
  } catch {
    return customerSessionFallback;
  }

  if (!raw) return customerSessionFallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as CustomerSession).name === 'string' &&
      typeof (parsed as CustomerSession).phone === 'string' &&
      (parsed as CustomerSession).phone.length <= 14 &&
      /^\d*$/.test((parsed as CustomerSession).phone) &&
      Number.isFinite((parsed as CustomerSession).createdAt) &&
      Number.isFinite((parsed as CustomerSession).expiresAt)
    ) {
      return {
        name: (parsed as CustomerSession).name,
        phone: (parsed as CustomerSession).phone,
        createdAt: (parsed as CustomerSession).createdAt,
        expiresAt: (parsed as CustomerSession).expiresAt,
      };
    }
  } catch {
    // Remove malformed data below.
  }

  try {
    sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
  } catch {
    // Ignore unavailable storage.
  }
  customerSessionFallback = null;
  return null;
}

function writeSession(value: CustomerSession | null): void {
  customerSessionFallback = value;
  try {
    if (value) {
      sessionStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
    }
  } catch {
    // In-memory fallback remains available for this page session.
  }
}

export function getCustomerName(now = Date.now()): string | null {
  return getCustomerSession(now)?.name ?? null;
}

export function getCustomerSession(now = Date.now()): CustomerSession | null {
  const existing = readStoredSession();
  if (!existing) return null;
  if (existing.expiresAt <= now || existing.createdAt > existing.expiresAt) {
    writeSession(null);
    return null;
  }
  return existing;
}

export function saveCustomerSession(
  name: string,
  phone: string,
  now = Date.now()
): void {
  const existing = getCustomerSession(now);
  const session: CustomerSession = existing
    ? { ...existing, name: name.trim(), phone: phone.replace(/\D/g, '').slice(0, 14) }
    : {
        name: name.trim(),
        phone: phone.replace(/\D/g, '').slice(0, 14),
        createdAt: now,
        expiresAt: now + CUSTOMER_NAME_SESSION_DURATION_MS,
      };
  writeSession(session);
}

export function saveCustomerName(name: string, now = Date.now()): void {
  const existing = getCustomerSession(now);
  saveCustomerSession(name, existing?.phone ?? '', now);
}

export function clearCustomerNameSession(): void {
  writeSession(null);
}
