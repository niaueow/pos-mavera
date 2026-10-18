/**
 * Format monetary number into Indonesian Rupiah (IDR) format.
 * Example: 20000 -> "Rp 20.000"
 */
export function formatIDR(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
