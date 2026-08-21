const WEB_SCHEMES = ['http:', 'https:'];

export function webHref(value: string): string | null {
  try {
    return WEB_SCHEMES.includes(new URL(value).protocol) ? value : null;
  } catch {
    return null;
  }
}
