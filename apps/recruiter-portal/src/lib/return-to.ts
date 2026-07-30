/** A `returnTo` arrives in the URL, so only same-origin, root-relative destinations survive. */
export function safeReturnTo(value: string | undefined | null): string | null {
  if (!value?.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}
