import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { CircleCheck, ListChecks } from 'lucide-react';
import { isReady } from '@/features/cvs/cv';
import { useMyCvs } from '@/features/cvs/hooks/use-my-cvs';
import { completionPercent, missingRequirements, REQUIREMENT_ACTIONS } from '../completeness';
import { useMyProfile } from '../hooks/use-my-profile';

export function CompletionNotice() {
  const { data: profile } = useMyProfile();
  const cvs = useMyCvs();

  if (cvs.data === undefined) return null;

  const missing = missingRequirements({
    has_a_read_cv: cvs.data.some((cv) => cv.is_current && isReady(cv)),
    full_name: profile.full_name,
    phone: profile.phone,
    phone_country: profile.phone_country,
    headline: profile.headline,
    summary: profile.summary,
    location_key: profile.location_key,
    canonical_role_key: profile.canonical_role_key,
    experiences: profile.experiences?.length,
    educations: profile.educations?.length,
    skills: profile.skills?.length,
    languages: profile.languages?.length,
  });

  if (missing.length === 0) {
    return (
      <Alert>
        <CircleCheck aria-hidden="true" />
        <AlertTitle>Your profile is complete</AlertTitle>
        <AlertDescription>
          You can apply to jobs, and you can let recruiters find you.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <ListChecks aria-hidden="true" />
      <AlertTitle>Your profile is {completionPercent(missing)}% complete</AlertTitle>
      <AlertDescription>
        <p>Finish these to apply to jobs and be found by recruiters. Saving now keeps your work.</p>
        <ul className="list-disc space-y-0.5 ps-5">
          {missing.map((requirement) => (
            <li key={requirement}>{REQUIREMENT_ACTIONS[requirement]}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
