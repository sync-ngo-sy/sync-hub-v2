import { type Control, useFormState } from 'react-hook-form';
import type { ProfileFormValues } from '../schemas/profile';

type Section = 'educations' | 'skills' | 'languages';

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
