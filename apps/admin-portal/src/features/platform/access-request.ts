import type { components } from '@sync/api-client';

export type AccessRequest = components['schemas']['AccessRequestView'];

export function suggestedSlug(company: string): string {
  const slug = company
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 63)
    .replaceAll(/-+$/g, '');
  return slug.length < 2 ? '' : slug;
}

export function askedOn(request: AccessRequest): string {
  return new Date(request.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
