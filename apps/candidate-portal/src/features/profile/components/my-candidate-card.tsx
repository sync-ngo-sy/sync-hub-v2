import { useCurrentProfile } from '@/features/auth/current-profile';
import { useCanonicalRoles } from '@/features/reference/hooks/use-canonical-roles';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { useMyProfile } from '../hooks/use-my-profile';
import { CandidateCard, type CandidateFact } from './candidate-card';
import { PhotoPicker } from './photo-picker';

function years(count: number): string {
  return `${count} ${count === 1 ? 'year' : 'years'}`;
}

export function MyCandidateCard() {
  const { data: profile } = useMyProfile();
  const { data: account } = useCurrentProfile();
  const roles = useCanonicalRoles();
  const known = useLanguages();

  const role = roles.data?.find(({ key }) => key === profile.canonical_role_key);
  const spoken = (profile.languages ?? [])
    .map(({ code }) => known.data?.find((language) => language.code === code)?.name)
    .filter((name): name is string => Boolean(name));

  const facts: CandidateFact[] = [
    {
      label: 'Total experience',
      value: profile.total_experience_years == null ? null : years(profile.total_experience_years),
    },
    { label: 'Languages', value: spoken.length > 0 ? spoken.join(', ') : null },
  ];

  return (
    <div className="space-y-3">
      <CandidateCard
        name={profile.full_name}
        avatarUrl={account.avatar_url}
        email={account.email}
        phone={profile.phone}
        links={{
          linkedinUrl: profile.linkedin_url,
          githubUrl: profile.github_url,
          portfolioUrl: profile.portfolio_url,
        }}
        canonicalRole={role?.name}
        headline={profile.headline}
        facts={facts}
        factsLabel="Your facts"
      />
      <PhotoPicker hasPhoto={Boolean(account.avatar_url)} />
    </div>
  );
}
