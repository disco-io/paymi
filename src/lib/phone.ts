/** Normalize US phone to E.164 (+1XXXXXXXXXX). */
export function toE164US(digits: string): string | null {
  const cleaned = digits.replace(/\D/g, '');
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (cleaned.startsWith('1') && cleaned.length === 11) return `+${cleaned}`;
  return null;
}

export function formatPhoneDisplay(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return e164;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-4);
  return `••• ${d}`;
}
