import { FormField } from '@sync/ui/components/form-field';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Input } from '@sync/ui/components/ui/input';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { type Control, useFieldArray } from 'react-hook-form';
import { BLANK_EXPERIENCE, type ProfileFormValues } from '../schemas/profile';
import { EntryList } from './entry-list';
import { PeriodFields } from './period-fields';
import { ProfileSection } from './profile-section';

export function ExperiencesSection({ control }: { control: Control<ProfileFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'experiences' });

  return (
    <ProfileSection title="Experience" description="Newest first, or whatever order suits you.">
      <EntryList
        ids={fields.map((field) => field.id)}
        label={(index) => `Job ${index + 1}`}
        addLabel="Add a job"
        empty="No jobs listed yet."
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
