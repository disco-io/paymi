/** Normalize to lowercase handle without @. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/** Letters, numbers, `.` and `_` only. 3–24 chars. Numbers optional. */
export function isValidUsername(username: string): boolean {
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return false;
  if (/^[._]|[._]$/.test(username)) return false;
  if (/\.\./.test(username)) return false;
  return true;
}

export function usernameValidationMessage(): string {
  return 'username must be 3–24 characters: letters, numbers, . or _';
}

export function formatUsernameDisplay(username: string): string {
  return `@${normalizeUsername(username)}`;
}
