import { FormField } from '@sync/ui/components/form-field';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { Switch } from '@sync/ui/components/ui/switch';
import { cn } from '@sync/ui/lib/utils';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Control } from 'react-hook-form';
import { REQUIREMENTS } from '../completeness';
import { useProfileProgress } from '../hooks/use-profile-progress';
import { REQUIREMENT_PLACES, type SectionId } from '../places';
import type { ProfileFormValues } from '../schemas/profile';

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function showSection(id: SectionId): void {
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

function Panel({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <aside
      id="progress"
      aria-label="Profile progress"
      className="lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
    >
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">{heading}</div>
          {children}
        </CardContent>
      </Card>
    </aside>
  );
}

function Headline({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="font-heading text-title text-card-foreground">Profile progress</p>
      {children}
    </div>
  );
}

export function CompletionPanel({ control }: { control: Control<ProfileFormValues> }) {
  const { missing, percent } = useProfileProgress(control);

  if (missing === undefined) {
    return (
      <Panel
        heading={
          <>
            <Skeleton className="size-16 shrink-0 rounded-full" />
            <Headline>
              <Skeleton className="h-4 w-28" />
            </Headline>
          </>
        }
      >
        <Skeleton className="h-48 w-full lg:h-96" />
      </Panel>
    );
  }

  const done = REQUIREMENTS.length - missing.length;

  return (
    <Panel
      heading={
        <>
          <CompletionRing percent={percent} />
          <Headline>
            <p className="text-meta text-muted-foreground">
              {missing.length === 0
                ? `All ${REQUIREMENTS.length} done.`
                : `${done} of ${REQUIREMENTS.length} done`}
            </p>
          </Headline>
        </>
      }
    >
      <ol className="grid grid-cols-2 gap-x-2 gap-y-0.5 lg:grid-cols-1">
        {REQUIREMENTS.map((requirement) => {
          const place = REQUIREMENT_PLACES[requirement];
          const met = !missing.includes(requirement);
          return (
            <li key={requirement}>
              <button
                type="button"
                aria-label={`${place.label} — ${met ? 'done' : 'still to do'}`}
                onClick={() => showSection(place.section)}
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
                <span aria-hidden="true" className="min-w-0">
                  {place.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="text-meta text-muted-foreground">
        {missing.length === 0
          ? 'You can apply to jobs, and you can let recruiters find you.'
          : 'Finish all of them to apply to jobs. Saving now keeps your work.'}
      </p>

      <div className="border-border border-t pt-4">
        <FormField
          control={control}
          name="is_searchable"
          label="Let recruiters find me"
          description={
            missing.length === 0
              ? 'Adds you to Global search.'
              : 'Adds you to Global search, once everything above is ticked.'
          }
          orientation="horizontal"
        >
          {({ value, onChange, ...field }) => (
            <Switch
              {...field}
              checked={value === true && missing.length === 0}
              onCheckedChange={onChange}
              disabled={missing.length > 0}
            />
          )}
        </FormField>
      </div>
    </Panel>
  );
}
