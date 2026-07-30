// The API client is created before the router exists, so `onSessionExpired` can't close over a
// router instance directly. The router registers its handler once it's built (see router.ts).
let sessionExpiredHandler: (() => void) | null = null;

// A 401 means "no session" for both a never-signed-in visitor and one whose session just died.
// Only the latter should be pulled to login: an anonymous 401 probing `/auth/me` on a public
// page must not redirect. This latch records whether the app currently believes it holds a live
// session, so `notifySessionExpired` can tell the two apart.
let authenticated = false;

export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler;
}

export function setAuthenticated(value: boolean): void {
  authenticated = value;
}

export function notifySessionExpired(): void {
  if (!authenticated) return;
  authenticated = false;
  sessionExpiredHandler?.();
}
