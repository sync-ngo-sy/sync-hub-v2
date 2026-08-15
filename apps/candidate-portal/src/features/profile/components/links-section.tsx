import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import type { Control } from 'react-hook-form';
import type { ProfileFormValues } from '../schemas/profile';
import { ProfileSection } from './profile-section';

export function LinksSection({ control }: { control: Control<ProfileFormValues> }) {
  return (
    <ProfileSection
      title="Links"
      description="Where a recruiter can see your work. Your handle on its own is enough."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={control} name="linkedin_url" label="LinkedIn">
          {(field) => <Input {...field} inputMode="url" placeholder="amina-haddad" />}
        </FormField>

        <FormField control={control} name="github_url" label="GitHub">
          {(field) => <Input {...field} inputMode="url" placeholder="amina-haddad" />}
        </FormField>
      </div>

      <FormField
        control={control}
        name="portfolio_url"
        label="Portfolio or website"
        description="Anything of your own: a site, a blog, a public folder of work."
      >
        {(field) => <Input {...field} inputMode="url" placeholder="amina-haddad.dev" />}
      </FormField>
    </ProfileSection>
  );
}
