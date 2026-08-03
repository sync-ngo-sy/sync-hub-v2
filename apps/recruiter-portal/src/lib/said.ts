export function said(value: string | null | undefined): string | null {
  return value === undefined || value === null || value.trim() === '' ? null : value;
}
