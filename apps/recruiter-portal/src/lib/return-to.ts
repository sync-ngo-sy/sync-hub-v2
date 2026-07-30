/**
 * A `returnTo` arrives in the URL, so it is attacker-supplied: only same-origin,
 * root-relative destinations survive. Anything else falls back to the caller's default.
 */
export function safeReturnTo(value: string | undefined | null): string | null {
  if (!value?.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}
