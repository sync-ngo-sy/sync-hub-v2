import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import type { Control } from 'react-hook-form';
import type { ProfileFormValues } from '../schemas/profile';
import { ProfileSection } from './profile-section';
import { useUnanswered } from './section-error';

const ADDRESSES = [
  'linkedin_url',
  'github_url',
  'portfolio_url',
] as const satisfies readonly (keyof ProfileFormValues)[];

export function LinksSection({ control }: { control: Control<ProfileFormValues> }) {
  const unanswered = useUnanswered(control, ADDRESSES);

  return (
    <ProfileSection
      id="links"
      title="Links"
      description="Where a recruiter can see your work. Your handle on its own is enough."
      unanswered={unanswered}
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
