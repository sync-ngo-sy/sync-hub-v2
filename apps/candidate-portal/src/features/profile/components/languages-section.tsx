import type { components } from '@sync/api-client';
import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync/ui/components/ui/select';
import { type Control, useFieldArray } from 'react-hook-form';
import { BLANK_LANGUAGE, PROFICIENCIES, type ProfileFormValues } from '../schemas/profile';
import { EntryList } from './entry-list';
import { ProfileSection } from './profile-section';

const LABELS: Record<components['schemas']['LanguageProficiency'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  fluent: 'Fluent',
  native: 'Native',
};

export function LanguagesSection({ control }: { control: Control<ProfileFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'languages' });

  return (
    <ProfileSection title="Languages" description="By their code — ar, en, fr, tr.">
      <EntryList
        ids={fields.map((field) => field.id)}
        label={(index) => `Language ${index + 1}`}
        addLabel="Add a language"
        empty="No languages listed yet."
        onAdd={() => append(BLANK_LANGUAGE)}
        onRemove={remove}
      >
        {(index) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={control} name={`languages.${index}.code`} label="Language code">
              {(field) => <Input {...field} placeholder="ar" />}
            </FormField>
            <FormField
              control={control}
              name={`languages.${index}.proficiency`}
              label="Proficiency"
            >
              {({ value, onChange, onBlur, name, id, ...aria }) => (
                <Select items={LABELS} name={name} value={value} onValueChange={onChange}>
                  <SelectTrigger id={id} onBlur={onBlur} className="w-full" {...aria}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFICIENCIES.map((proficiency) => (
                      <SelectItem key={proficiency} value={proficiency}>
                        {LABELS[proficiency]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>
        )}
      </EntryList>
    </ProfileSection>
  );
}
