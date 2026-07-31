import type { UseFormSetError } from 'react-hook-form';
import { errorStatus } from '../../../lib/errors';
import type { ProfileFormValues } from '../schemas/profile-schema';

interface InvalidField {
  location: string;
  message: string;
}

function invalidFields(error: unknown): InvalidField[] {
  if (typeof error !== 'object' || error === null || !('errors' in error)) return [];
  const { errors } = error as { errors: unknown };
  if (!Array.isArray(errors)) return [];
  return errors.filter(
    (entry): entry is InvalidField =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.location === 'string' &&
      typeof entry.message === 'string',
  );
}

function detailOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const { detail } = error as { detail: unknown };
    if (typeof detail === 'string') return detail;
  }
  return undefined;
}

/**
 * The server locates a rejected value as `body.skills.0.name`; React Hook Form names the same
 * field `skills.0.name`. `unmapped_skills` is the one section the form wraps in objects, so a
 * bare `unmapped_skills.2` becomes `unmapped_skills.2.value`.
 */
function toFieldName(location: string): string | null {
  if (!location.startsWith('body.')) return null;
  const path = location.slice('body.'.length);
  return /^unmapped_skills\.\d+$/.test(path) ? `${path}.value` : path;
}

/**
 * Renders a server rejection in the form: 422 validation errors at their fields (409 CV-required
 * on the searchable toggle), anything without a field at the form root. Returns whether it
 * belonged in the form at all — a 500 or a network failure is homeless, and the caller toasts it.
 */
export function applyServerErrors(
  error: unknown,
  setError: UseFormSetError<ProfileFormValues>,
): boolean {
  const status = errorStatus(error);

  if (status === 409) {
    setError('is_searchable', {
      message: detailOf(error) ?? 'Making your profile searchable needs a current, ready CV.',
    });
    return true;
  }

  if (status === 422) {
    const fields = invalidFields(error);
    let placed = false;
    for (const { location, message } of fields) {
      const name = toFieldName(location);
      if (name) {
        setError(name as Parameters<UseFormSetError<ProfileFormValues>>[0], { message });
        placed = true;
      }
    }
    setError('root', {
      message: placed
        ? 'Some entries were rejected — see the highlighted fields.'
        : (detailOf(error) ?? 'Your profile could not be saved.'),
    });
    return true;
  }

  return false;
}
