/**
 * A `returnTo` reaches us through the URL, so anyone can write it. Only a destination
 * inside this portal survives — everything a browser would resolve to another origin
 * is dropped rather than followed.
 */
export function resolveReturnTo(value: string | null | undefined): string | null {
  if (!value?.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}
