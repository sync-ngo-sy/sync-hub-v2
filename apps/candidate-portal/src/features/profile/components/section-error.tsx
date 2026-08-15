import { type Control, useFormState } from 'react-hook-form';
import type { ProfileFormValues } from '../schemas/profile';

type Name = keyof ProfileFormValues;
type Section = 'educations' | 'skills' | 'languages';

export function useUnanswered(
  control: Control<ProfileFormValues>,
  names: Name | readonly Name[],
): boolean {
  const { errors } = useFormState({ control, name: names });
  const named = typeof names === 'string' ? [names] : names;
  return named.some((name) => errors[name] !== undefined);
}

export function SectionError({
  control,
  name,
}: {
  control: Control<ProfileFormValues>;
  name: Section;
}) {
  const { errors } = useFormState({ control, name });
  const message = (errors[name] as { message?: string } | undefined)?.message;

  if (!message) return null;
  return (
    <p role="alert" className="text-dense text-destructive">
      {message}
    </p>
  );
}
