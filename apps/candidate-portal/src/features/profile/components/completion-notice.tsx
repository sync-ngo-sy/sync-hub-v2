import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { isReady } from '@/features/cvs/cv';
import { useMyCvs } from '@/features/cvs/hooks/use-my-cvs';
import { completionPercent, missingRequirements, REQUIREMENT_ACTIONS } from '../completeness';
import { useMyProfile } from '../hooks/use-my-profile';

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CompletionRing({ percent }: { percent: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="size-14 shrink-0"
      role="img"
      aria-label={`${percent}% of your profile is complete`}
    >
      <circle cx="32" cy="32" r={RADIUS} fill="none" strokeWidth="6" className="stroke-border" />
      <circle
        cx="32"
        cy="32"
        r={RADIUS}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
        transform="rotate(-90 32 32)"
        className="stroke-primary transition-[stroke-dashoffset] duration-500"
      />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-medium text-[0.9rem]"
      >
        {percent}%
      </text>
    </svg>
  );
}

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
    educations: profile.educations?.length,
    skills: profile.skills?.length,
    languages: profile.languages?.length,
  });
  const percent = completionPercent(missing);

  if (missing.length === 0) {
    return (
      <Alert>
        <CompletionRing percent={percent} />
        <AlertTitle>Your profile is complete</AlertTitle>
        <AlertDescription>
          You can apply to jobs, and you can let recruiters find you.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <CompletionRing percent={percent} />
      <AlertTitle>Your profile is {percent}% complete</AlertTitle>
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
