export function resolveReturnTo(value: string | undefined): string | null {
  if (!value?.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}
