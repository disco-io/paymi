/** First word of a display name, for compact labels. */
export function firstName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return '?';
  return trimmed.split(/\s+/)[0];
}
