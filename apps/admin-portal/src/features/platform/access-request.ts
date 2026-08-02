import type { components } from '@sync/api-client';
import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from './tenant-form-schema';

export type AccessRequest = components['schemas']['AccessRequestView'];

const askedOnFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function suggestedSlug(company: string): string {
  const slug = company
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replaceAll(/-+$/g, '');
  return slug.length < SLUG_MIN_LENGTH ? '' : slug;
}

export function askedOn(createdAt: string): string {
  return askedOnFormat.format(new Date(createdAt));
}
