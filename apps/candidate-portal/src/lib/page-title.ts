export const PORTAL_TITLE = 'Sync';

export function pageTitle(page: string): string {
  return `${page} · ${PORTAL_TITLE}`;
}

/** The landing is the one page titled for a search result rather than for the app's chrome. */
export function landingTitle(tagline: string): string {
  return `${PORTAL_TITLE} — ${tagline}`;
}
