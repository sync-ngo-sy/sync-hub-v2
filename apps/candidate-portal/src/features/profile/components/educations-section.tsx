import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { GraduationCap } from 'lucide-react';
import { type Control, useFieldArray } from 'react-hook-form';
import { BLANK_EDUCATION, type ProfileFormValues } from '../schemas/profile';
import { EntryList } from './entry-list';
import { ProfileSection } from './profile-section';

export function EducationsSection({ control }: { control: Control<ProfileFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'educations' });

  return (
    <ProfileSection title="Education" description="Degrees, diplomas and courses.">
      <EntryList
        ids={fields.map((field) => field.id)}
        label={(index) => `Qualification ${index + 1}`}
        icon={GraduationCap}
        addLabel="Add a qualification"
        empty="No qualifications listed yet — add a degree, diploma or course."
        onAdd={() => append(BLANK_EDUCATION)}
        onRemove={remove}
      >
        {(index) => (
          <>
            <FormField
              control={control}
              name={`educations.${index}.institution`}
              label="Institution"
            >
              {(field) => <Input {...field} />}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={control} name={`educations.${index}.degree`} label="Degree">
                {(field) => <Input {...field} placeholder="BSc" />}
              </FormField>
              <FormField
                control={control}
                name={`educations.${index}.field_of_study`}
                label="Field of study"
              >
                {(field) => <Input {...field} placeholder="Public Health" />}
              </FormField>
            </div>

            <FormField
              control={control}
              name={`educations.${index}.graduation_year`}
              label="Graduation year"
              className="sm:max-w-40"
            >
              {(field) => <Input {...field} inputMode="numeric" placeholder="2018" />}
            </FormField>

            <FormField control={control} name={`educations.${index}.description`} label="Notes">
              {(field) => <Textarea {...field} rows={3} />}
            </FormField>
          </>
        )}
      </EntryList>
    </ProfileSection>
  );
}
