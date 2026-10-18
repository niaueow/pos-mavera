import { describe, it, expect } from 'vitest';
import { formatIDR } from '../utils/currency';

describe('Currency Formatter Utility', () => {
  it('should format positive integer IDR correctly', () => {
    const formatted = formatIDR(20000);
    expect(formatted).toContain('20.000');
    expect(formatted).toContain('Rp');
  });

  it('should format 0 as Rp 0', () => {
    const formatted = formatIDR(0);
    expect(formatted).toContain('0');
    expect(formatted).toContain('Rp');
  });

  it('should handle NaN or invalid input gracefully', () => {
    expect(formatIDR(NaN)).toBe('Rp 0');
  });
});
