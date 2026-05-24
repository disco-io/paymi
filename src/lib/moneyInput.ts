/** Sanitize typed money string (digits + one decimal, max 2 fractional digits). */
export function sanitizeMoneyDraft(input: string): string {
  let cleaned = input.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot !== -1) {
    const whole = cleaned.slice(0, dot);
    const frac = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
    cleaned = `${whole}.${frac}`;
  }
  return cleaned;
}

export function parseMoneyDraftToCents(text: string): number {
  const trimmed = text.trim();
  if (!trimmed || trimmed === '.') return 0;
  const n = parseFloat(trimmed);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Load into field on focus so digits/decimals match what user sees when blurred. */
export function centsToEditableString(cents: number): string {
  if (cents === 0) return '';
  return (cents / 100).toFixed(2);
}

/** String shown when field is blurred (empty if zero). */
export function centsToDisplay(cents: number): string {
  if (cents === 0) return '';
  return (cents / 100).toFixed(2);
}
