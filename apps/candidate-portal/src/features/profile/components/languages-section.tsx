import { FormField } from '@sync/ui/components/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync/ui/components/ui/select';
import { Languages } from 'lucide-react';
import { type Control, useFieldArray, useWatch } from 'react-hook-form';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { languageOptions } from '@/features/reference/options';
import { BLANK_LANGUAGE, PROFICIENCY_LABELS, type ProfileFormValues } from '../schemas/profile';
import { takenElsewhere } from '../taken-elsewhere';
import { EntryList } from './entry-list';
import { ProfileSection } from './profile-section';
import { SectionError } from './section-error';

export function LanguagesSection({ control }: { control: Control<ProfileFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'languages' });
  const known = useLanguages();
  const listed = useWatch({ control, name: 'languages' });

  return (
    <ProfileSection
      title="Languages"
      description="The ones you speak, and how well."
      needed="One language needed to apply"
    >
      <SectionError control={control} name="languages" />
      <EntryList
        ids={fields.map((field) => field.id)}
        label={(index) => `Language ${index + 1}`}
        icon={Languages}
        addLabel="Add a language"
        empty="No languages listed yet — add the ones you speak."
        onAdd={() => append(BLANK_LANGUAGE)}
        onRemove={remove}
      >
        {(index) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={control} name={`languages.${index}.code`} label="Language">
              {({ value, onChange, onBlur, id, ...aria }) => (
                <ReferencePicker
                  id={id}
                  noun="language"
                  list={known}
                  options={languageOptions(
                    known.data,
                    takenElsewhere(listed, index, (entry) => entry.code),
                  )}
                  value={value || null}
                  onChange={onChange}
                  onBlur={onBlur}
                  aria-describedby={aria['aria-describedby']}
                  aria-invalid={aria['aria-invalid']}
                />
              )}
            </FormField>
            <FormField
              control={control}
              name={`languages.${index}.proficiency`}
              label="Proficiency"
            >
              {({ value, onChange, onBlur, name, id, ...aria }) => (
                <Select
                  items={PROFICIENCY_LABELS}
                  name={name}
                  value={value}
                  onValueChange={onChange}
                >
                  <SelectTrigger id={id} onBlur={onBlur} className="w-full" {...aria}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROFICIENCY_LABELS).map(([proficiency, label]) => (
                      <SelectItem key={proficiency} value={proficiency}>
                        {label}
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
