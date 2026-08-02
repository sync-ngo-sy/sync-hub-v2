import { Combobox } from '@sync/ui/components/combobox';
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
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { languageOptions } from '@/features/reference/options';
import { BLANK_LANGUAGE, PROFICIENCY_LABELS, type ProfileFormValues } from '../schemas/profile';
import { EntryList } from './entry-list';
import { ProfileSection } from './profile-section';

type LanguageEntry = ProfileFormValues['languages'][number];

/** What the other rows hold, so the same language cannot be listed twice. */
function takenElsewhere(entries: LanguageEntry[] | undefined, index: number): string[] {
  return (entries ?? []).filter((_, at) => at !== index).map((entry) => entry.code);
}

export function LanguagesSection({ control }: { control: Control<ProfileFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'languages' });
  const known = useLanguages();
  const listed = useWatch({ control, name: 'languages' });

  return (
    <ProfileSection title="Languages" description="The ones you speak, and how well.">
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
                <Combobox
                  id={id}
                  options={languageOptions(known.data, takenElsewhere(listed, index))}
                  value={value || null}
                  onValueChange={(code) => onChange(code ?? '')}
                  onBlur={onBlur}
                  placeholder="Type to search"
                  loading={known.isPending}
                  loadingMessage="Loading languages…"
                  emptyMessage={
                    known.isError
                      ? "The language list couldn't be loaded."
                      : 'No language by that name.'
                  }
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
