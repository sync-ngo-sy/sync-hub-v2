import { Combobox } from '@sync/ui/components/combobox';
import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import { Switch } from '@sync/ui/components/ui/switch';
import { Textarea } from '@sync/ui/components/ui/textarea';
import type { Control } from 'react-hook-form';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { languageOptions } from '@/features/reference/options';
import type { ProfileFormValues } from '../schemas/profile';
import { ProfileSection } from './profile-section';

/** Having no preference is a choice, so it is on the list rather than left to a blank field. */
const NO_PREFERENCE = { value: '', label: 'No preference' };

export function IdentitySection({ control }: { control: Control<ProfileFormValues> }) {
  const known = useLanguages();

  return (
    <ProfileSection title="About you" description="The first thing a recruiter reads.">
      <FormField control={control} name="full_name" label="Full name">
        {(field) => <Input {...field} autoComplete="name" />}
      </FormField>

      <FormField control={control} name="phone" label="Phone">
        {(field) => <Input {...field} type="tel" autoComplete="tel" />}
      </FormField>

      <FormField
        control={control}
        name="headline"
        label="Headline"
        description="One line, the way you would introduce yourself."
      >
        {(field) => <Input {...field} placeholder="Field coordinator, 6 years" />}
      </FormField>

      <FormField control={control} name="location" label="Location">
        {(field) => (
          <Input {...field} autoComplete="address-level2" placeholder="Damascus, Syria" />
        )}
      </FormField>

      <FormField control={control} name="summary" label="Summary">
        {(field) => <Textarea {...field} rows={5} />}
      </FormField>

      <FormField
        control={control}
        name="preferred_language_code"
        label="Preferred language"
        description="The one you would rather be contacted in. Recruiters filter on it."
      >
        {({ value, onChange, onBlur, id, ...aria }) => (
          <Combobox
            id={id}
            className="sm:max-w-60"
            options={[NO_PREFERENCE, ...languageOptions(known.data)]}
            value={value}
            onValueChange={(code) => onChange(code ?? '')}
            onBlur={onBlur}
            placeholder="Type to search"
            loading={known.isPending}
            loadingMessage="Loading languages…"
            emptyMessage={
              known.isError ? "The language list couldn't be loaded." : 'No language by that name.'
            }
            aria-describedby={aria['aria-describedby']}
            aria-invalid={aria['aria-invalid']}
          />
        )}
      </FormField>

      <FormField
        control={control}
        name="is_searchable"
        label="Let recruiters find me"
        description="Adds you to Global search. Needs a current CV that has been read."
        orientation="horizontal"
      >
        {({ value, onChange, ...field }) => (
          <Switch {...field} checked={value === true} onCheckedChange={onChange} />
        )}
      </FormField>
    </ProfileSection>
  );
}
