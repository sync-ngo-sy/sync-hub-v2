import { CandidateCard } from '@sync/ui/components/candidate-card';
import { useCurrentProfile } from '@/features/auth/current-profile';
import { useCanonicalRoles } from '@/features/reference/hooks/use-canonical-roles';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { useMyProfile } from '../hooks/use-my-profile';

export function MyCandidateCard() {
  const { data: profile } = useMyProfile();
  const { data: account } = useCurrentProfile();
  const roles = useCanonicalRoles();
  const known = useLanguages();

  const role = roles.data?.find(({ key }) => key === profile.canonical_role_key);
  const spoken = (profile.languages ?? [])
    .map(({ code }) => known.data?.find((language) => language.code === code)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <CandidateCard
      name={profile.full_name}
      avatarUrl={account.avatar_url}
      email={account.email}
      phone={profile.phone}
      role={role?.name}
      yearsOfExperience={profile.total_experience_years}
      languages={spoken}
    />
  );
}
