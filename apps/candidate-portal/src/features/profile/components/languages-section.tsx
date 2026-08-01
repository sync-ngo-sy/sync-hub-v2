import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync/ui/components/ui/select';
import { Languages } from 'lucide-react';
import { type Control, useFieldArray } from 'react-hook-form';
import { BLANK_LANGUAGE, PROFICIENCY_LABELS, type ProfileFormValues } from '../schemas/profile';
import { EntryList } from './entry-list';
import { ProfileSection } from './profile-section';

export function LanguagesSection({ control }: { control: Control<ProfileFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'languages' });

  return (
    <ProfileSection title="Languages" description="By their code — ar, en, fr, tr.">
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
            <FormField control={control} name={`languages.${index}.code`} label="Language code">
              {(field) => <Input {...field} placeholder="ar" />}
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
