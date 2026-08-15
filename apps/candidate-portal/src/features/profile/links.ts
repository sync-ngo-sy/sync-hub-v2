/**
 * The rules the API holds a Link to, restated: a handle becomes the whole address, and anything
 * that is not that kind of address at all is not saved as one. Each of the three returns `null`
 * for text the platform cannot make an address of, which is what the field says out loud — the
 * API would refuse it, and the answer is better given before the save than after it.
 */

const HANDLE = /^[A-Za-z0-9][A-Za-z0-9-]{1,98}[A-Za-z0-9]$/;
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const LINKEDIN_HOST = /^([a-z0-9-]+\.)?linkedin\.com$/;
const GITHUB_HOST = /^(www\.)?github\.com$/;
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export const MAX_LINK = 2000;

export function linkedinAddress(typed: string): string | null {
  const written = typed.trim();
  const handle =
    asHandle(written.slice(0, 3).toLowerCase() === 'in/' ? written.slice(3) : written) ??
    asLinkedInPath(written);
  return handle === null ? null : withinLength(`https://www.linkedin.com/in/${handle}`);
}

export function githubAddress(typed: string): string | null {
  const handle = asHandle(typed) ?? asHandle(segments(typed, GITHUB_HOST)?.[0] ?? '');
  return handle === null ? null : withinLength(`https://github.com/${handle}`);
}

export function portfolioAddress(typed: string): string | null {
  const address = asAddress(typed);
  const host = address?.host.toLowerCase();
  if (address === null || host === undefined || !HOST.test(host)) return null;
  const path = address.pathname.replace(/\/+$/, '');
  return withinLength(`${address.protocol}//${host}${path}${address.search}${address.hash}`);
}

function asHandle(typed: string): string | null {
  const handle = typed.trim().replace(/^@+/, '');
  return HANDLE.test(handle) ? handle : null;
}

function asLinkedInPath(typed: string): string | null {
  const path = segments(typed, LINKEDIN_HOST);
  if (path === null || path.length !== 2 || path[0]?.toLowerCase() !== 'in') return null;
  return asHandle(path[1] ?? '');
}

function segments(typed: string, host: RegExp): string[] | null {
  const address = asAddress(typed);
  if (address === null || !host.test(address.hostname)) return null;
  const path = address.pathname.split('/').filter(Boolean);
  return path.length > 0 ? path : null;
}

function asAddress(typed: string): URL | null {
  const trimmed = typed.trim();
  if (trimmed === '' || /\s/.test(trimmed)) return null;
  const written = SCHEME.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;
  try {
    const address = new URL(written);
    const opens = address.protocol === 'https:' || address.protocol === 'http:';
    return opens && address.username === '' && address.password === '' ? address : null;
  } catch {
    return null;
  }
}

function withinLength(address: string): string | null {
  return address.length > MAX_LINK ? null : address;
}
