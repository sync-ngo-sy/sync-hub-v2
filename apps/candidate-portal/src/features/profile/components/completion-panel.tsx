import { Card, CardContent } from '@sync/ui/components/ui/card';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { cn } from '@sync/ui/lib/utils';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { type Control, useWatch } from 'react-hook-form';
import { isReady } from '@/features/cvs/cv';
import { useMyCvs } from '@/features/cvs/hooks/use-my-cvs';
import {
  completionPercent,
  missingRequirements,
  REQUIREMENT_STEPS,
  REQUIREMENTS,
} from '../completeness';
import type { ProfileFormValues } from '../schemas/profile';

const ANSWERS = [
  'full_name',
  'phone',
  'phone_country',
  'headline',
  'summary',
  'location_key',
  'canonical_role_key',
  'educations',
  'skills',
  'languages',
] as const satisfies readonly (keyof ProfileFormValues)[];

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function showSection(id: string): void {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ block: 'start' });
  section.focus({ preventScroll: true });
}

function CompletionRing({ percent }: { percent: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="size-16 shrink-0"
      role="img"
      aria-label={
        percent === 100 ? 'Your profile is complete' : `Your profile is ${percent}% complete`
      }
    >
      <circle cx="32" cy="32" r={RADIUS} fill="none" strokeWidth="5" className="stroke-border" />
      <circle
        cx="32"
        cy="32"
        r={RADIUS}
        fill="none"
        strokeWidth="5"
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
        className="fill-foreground font-medium text-[1rem]"
      >
        {percent}%
      </text>
    </svg>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <aside
      aria-labelledby="profile-progress"
      className="lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
    >
      <Card>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </aside>
  );
}

export function CompletionPanel({ control }: { control: Control<ProfileFormValues> }) {
  const cvs = useMyCvs();
  const [
    fullName,
    phone,
    phoneCountry,
    headline,
    summary,
    locationKey,
    roleKey,
    educations,
    skills,
    languages,
  ] = useWatch({ control, name: ANSWERS });

  if (cvs.data === undefined) {
    return (
      <Panel>
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <h2 id="profile-progress" className="font-heading text-title text-card-foreground">
              Profile progress
            </h2>
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Skeleton className="h-48 w-full lg:h-96" />
      </Panel>
    );
  }

  const missing = missingRequirements({
    has_a_read_cv: cvs.data.some((cv) => cv.is_current && isReady(cv)),
    full_name: fullName,
    phone,
    phone_country: phoneCountry,
    headline,
    summary,
    location_key: locationKey,
    canonical_role_key: roleKey,
    educations: educations.length,
    skills: skills.length,
    languages: languages.length,
  });
  const percent = completionPercent(missing);
  const done = REQUIREMENTS.length - missing.length;

  return (
    <Panel>
      <div className="flex items-center gap-4">
        <CompletionRing percent={percent} />
        <div className="min-w-0 space-y-0.5">
          <h2 id="profile-progress" className="font-heading text-title text-card-foreground">
            Profile progress
          </h2>
          <p className="text-meta text-muted-foreground">
            {missing.length === 0
              ? 'Every step is done.'
              : `${done} of ${REQUIREMENTS.length} steps done`}
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-x-2 gap-y-0.5 lg:grid-cols-1">
        {REQUIREMENTS.map((requirement) => {
          const step = REQUIREMENT_STEPS[requirement];
          const met = !missing.includes(requirement);
          return (
            <li key={requirement}>
              <button
                type="button"
                onClick={() => showSection(step.section)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-start text-dense hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                  met ? 'text-muted-foreground' : 'font-medium text-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-px flex size-5 shrink-0 items-center justify-center rounded-full border',
                    met
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background',
                  )}
                >
                  {met ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  {step.label}
                  <span className="sr-only">{met ? ' — done' : ' — still to do'}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="text-meta text-muted-foreground">
        {missing.length === 0
          ? 'You can apply to jobs, and you can let recruiters find you.'
          : 'Finish every step to apply to jobs and to be found by recruiters. Saving now keeps your work.'}
      </p>
    </Panel>
  );
}
