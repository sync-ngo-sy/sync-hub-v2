import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import { Switch } from '@sync/ui/components/ui/switch';
import { Textarea } from '@sync/ui/components/ui/textarea';
import type { Control } from 'react-hook-form';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useCanonicalRoles } from '@/features/reference/hooks/use-canonical-roles';
import { useLocations } from '@/features/reference/hooks/use-locations';
import { locationGroups, roleOptions } from '@/features/reference/options';
import type { ProfileFormValues } from '../schemas/profile';
import { ProfileSection } from './profile-section';

const NO_ROLE = { value: '', label: 'Not saying' };

export function IdentitySection({ control }: { control: Control<ProfileFormValues> }) {
  const places = useLocations();
  const roles = useCanonicalRoles();

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

      <FormField
        control={control}
        name="location_key"
        label="Location"
        description="Where you are. Recruiters filter on it."
      >
        {({ value, onChange, onBlur, id, ...aria }) => (
          <ReferencePicker
            id={id}
            className="sm:max-w-60"
            noun="location"
            list={places}
            options={locationGroups(places.data)}
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
        name="canonical_role_key"
        label="What you do"
        description="The kind of work you are looking for. Recruiters filter on it."
      >
        {({ value, onChange, onBlur, id, ...aria }) => (
          <ReferencePicker
            id={id}
            className="sm:max-w-60"
            noun="role"
            list={roles}
            options={[NO_ROLE, ...roleOptions(roles.data)]}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            aria-describedby={aria['aria-describedby']}
            aria-invalid={aria['aria-invalid']}
          />
        )}
      </FormField>

      <FormField control={control} name="summary" label="Summary">
        {(field) => <Textarea {...field} rows={5} />}
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
