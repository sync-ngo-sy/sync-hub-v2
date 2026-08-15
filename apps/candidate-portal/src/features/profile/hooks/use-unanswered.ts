import { type Control, useFormState } from 'react-hook-form';
import type { Named } from '../places';
import type { ProfileFormValues } from '../schemas/profile';

export function useUnanswered(
  control: Control<ProfileFormValues>,
  names: readonly Named[],
): boolean {
  const { errors } = useFormState({ control, name: names });
  return names.some((name) => errors[name] !== undefined);
}
