import { FormField } from '@sync/ui/components/form-field';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Input } from '@sync/ui/components/ui/input';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { Briefcase } from 'lucide-react';
import { useEffect } from 'react';
import { type Control, type UseFormSetValue, useFieldArray, useWatch } from 'react-hook-form';
import { useDebounce } from 'use-debounce';
import { client } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import { BLANK_EXPERIENCE, type ProfileFormValues, toProfileExperiences } from '../schemas/profile';
import { EntryList } from './entry-list';
import { PeriodFields } from './period-fields';
import { ProfileSection } from './profile-section';
import { TotalExperience } from './total-experience';

const sameExperiences = (
  left: ProfileFormValues['experiences'],
  right: ProfileFormValues['experiences'],
) => JSON.stringify(left) === JSON.stringify(right);

export function ExperiencesSection({
  control,
  experiencesDirty,
  setValue,
}: {
  control: Control<ProfileFormValues>;
  experiencesDirty: boolean;
  setValue: UseFormSetValue<ProfileFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'experiences' });
  const saved = useWatch({ control, name: 'total_experience_years' });
  const experiences = useWatch({ control, name: 'experiences' });
  const [debouncedExperiences, debounce] = useDebounce(experiences, 400, {
    equalityFn: sameExperiences,
  });

  useEffect(() => {
    if (!experiencesDirty || debounce.isPending()) return;
    const body = toProfileExperiences(debouncedExperiences);
    if (!body) return;

    const controller = new AbortController();
    const calculate = async () => {
      const { data, error } = await client.POST('/v1/candidates/me/profile/experience-total', {
        body: { experiences: body },
        signal: controller.signal,
      });
      if (error) reportError(error, { boundary: 'widget', source: 'Total experience' });
      if (data) setValue('total_experience_years', data.total_experience_years);
    };
    calculate().catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      reportError(error, { boundary: 'widget', source: 'Total experience' });
    });
    return () => controller.abort();
  }, [debounce, debouncedExperiences, experiencesDirty, setValue]);

  return (
    <ProfileSection title="Experience" description="Newest first, or whatever order suits you.">
      <TotalExperience years={saved} />

      <EntryList
        ids={fields.map((field) => field.id)}
        label={(index) => `Job ${index + 1}`}
        icon={Briefcase}
        addLabel="Add a job"
        empty="No jobs listed yet — add the roles you want recruiters to see."
        onAdd={() => append(BLANK_EXPERIENCE)}
        onRemove={remove}
      >
        {(index) => (
          <>
            <FormField control={control} name={`experiences.${index}.job_title`} label="Job title">
              {(field) => <Input {...field} />}
            </FormField>

            <FormField
              control={control}
              name={`experiences.${index}.company_name`}
              label="Employer"
            >
              {(field) => <Input {...field} />}
            </FormField>

            <PeriodFields control={control} section="experiences" index={index} />

            <FormField
              control={control}
              name={`experiences.${index}.is_current`}
              label="I still work here"
              orientation="horizontal"
            >
              {({ value, onChange, ...field }) => (
                <Checkbox {...field} checked={value === true} onCheckedChange={onChange} />
              )}
            </FormField>

            <FormField
              control={control}
              name={`experiences.${index}.description`}
              label="What you did"
            >
              {(field) => <Textarea {...field} rows={4} />}
            </FormField>
          </>
        )}
      </EntryList>
    </ProfileSection>
  );
}
