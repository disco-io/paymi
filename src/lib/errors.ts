/** Pull a readable message from Supabase / unknown thrown values. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null) {
    const obj = e as { message?: unknown; error_description?: unknown; details?: unknown };
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error_description === 'string') return obj.error_description;
    if (typeof obj.details === 'string') return obj.details;
  }
  if (typeof e === 'string') return e;
  return 'something went wrong';
}

export function isMissingDbObjectError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('check_signup_available') ||
    m.includes('profile_payment_methods') ||
    m.includes('column') && m.includes('username') ||
    m.includes('schema cache') ||
    m.includes('delete_group') ||
    m.includes('is_group_leader') ||
    m.includes('does not exist')
  );
}
