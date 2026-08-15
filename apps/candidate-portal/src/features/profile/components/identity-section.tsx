import { FormField } from '@sync/ui/components/form-field';
import { PhoneField } from '@sync/ui/components/phone-field';
import { Input } from '@sync/ui/components/ui/input';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { type Control, useController } from 'react-hook-form';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useCanonicalRoles } from '@/features/reference/hooks/use-canonical-roles';
import { useLocations } from '@/features/reference/hooks/use-locations';
import { locationGroups, roleOptions } from '@/features/reference/options';
import { useUnanswered } from '../hooks/use-unanswered';
import { FIELDS_IN } from '../places';
import type { ProfileFormValues } from '../schemas/profile';
import { ProfileSection } from './profile-section';

const NO_ROLE = { value: '', label: 'Not saying' };

export function IdentitySection({ control }: { control: Control<ProfileFormValues> }) {
  const places = useLocations();
  const roles = useCanonicalRoles();
  const country = useController({ control, name: 'phone_country' });
  const unanswered = useUnanswered(control, FIELDS_IN['about-you']);

  return (
    <ProfileSection
      id="about-you"
      title="About you"
      description="The first thing a recruiter reads."
      needed="Needed to apply"
      unanswered={unanswered}
    >
      <FormField control={control} name="full_name" label="Full name">
        {(field) => <Input {...field} autoComplete="name" />}
      </FormField>

      <FormField
        control={control}
        name="phone"
        label="Phone"
        description="Needed to apply. Recruiters read it only on your full profile."
      >
        {({ value, onChange, onBlur, id, ...aria }) => (
          <PhoneField
            id={id}
            value={{ country: country.field.value, national: value }}
            onChange={(next) => {
              country.field.onChange(next.country);
              onChange(next.national);
            }}
            onBlur={() => {
              country.field.onBlur();
              onBlur();
            }}
            aria-describedby={aria['aria-describedby']}
            aria-invalid={aria['aria-invalid']}
          />
        )}
      </FormField>

      <FormField
        control={control}
        name="headline"
        label="Headline"
        description="One line, the way you would introduce yourself. Needed to apply."
      >
        {(field) => <Input {...field} placeholder="Field coordinator, 6 years" />}
      </FormField>

      <FormField
        control={control}
        name="location_key"
        label="Location"
        description="Where you are. Recruiters filter on it. Needed to apply."
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
        description="The kind of work you are looking for. Recruiters filter on it. Needed to apply."
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

      <FormField
        control={control}
        name="summary"
        label="Summary"
        description="A paragraph about your work. Needed to apply."
      >
        {(field) => <Textarea {...field} rows={5} />}
      </FormField>
    </ProfileSection>
  );
}
