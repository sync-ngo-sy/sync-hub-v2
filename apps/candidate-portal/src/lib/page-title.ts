export const PORTAL_TITLE = 'Sync';

export function pageTitle(page: string): string {
  return `${page} · ${PORTAL_TITLE}`;
}

export function landingTitle(tagline: string): string {
  return `${PORTAL_TITLE} — ${tagline}`;
}
