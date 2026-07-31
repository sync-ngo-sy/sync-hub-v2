import { zodResolver } from '@hookform/resolvers/zod';
import { EmptyState } from '@sync/ui/components/empty-state';
import { FormField } from '@sync/ui/components/form-field';
import { PageHeader } from '@sync/ui/components/page-header';
import { ListSkeleton, SkeletonText } from '@sync/ui/components/skeletons';
import { STATUS_TONES, StatusChip, type StatusTone } from '@sync/ui/components/status-chip';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Input } from '@sync/ui/components/ui/input';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { Info, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ThemeToggle } from '@/features/shell/components/theme-toggle';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-h3 text-foreground">{title}</h2>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-5">{children}</CardContent>
      </Card>
    </section>
  );
}

const applicationSchema = z.object({
  email: z.email('Enter a valid email address.'),
  note: z.string(),
  remote: z.boolean(),
});

function ApplicationForm() {
  const form = useForm({
    resolver: zodResolver(applicationSchema),
    defaultValues: { email: '', note: '', remote: false },
  });

  return (
    <form
      onSubmit={form.handleSubmit(() => undefined)}
      noValidate
      className="w-full max-w-sm space-y-5"
    >
      <FormField
        control={form.control}
        name="email"
        label="Email"
        description="Where recruiters reply."
      >
        {(field) => <Input {...field} type="email" placeholder="lina@example.test" />}
      </FormField>
      <FormField control={form.control} name="note" label="Note to the recruiter">
        {(field) => <Textarea {...field} placeholder="Three years of MEAL work in Idlib." />}
      </FormField>
      <FormField
        control={form.control}
        name="remote"
        label="Open to remote work"
        orientation="horizontal"
      >
        {({ value, onChange, ...field }) => (
          <Checkbox {...field} checked={value === true} onCheckedChange={onChange} />
        )}
      </FormField>
      <Button type="submit">Submit application</Button>
    </form>
  );
}

interface DemoApplication {
  job: string;
  tenant: string;
  tone: StatusTone;
  status: string;
}

/** The candidate list register: one row per Application, never a table (§10). */
const APPLICATIONS: DemoApplication[] = [
  {
    job: 'Field Coordinator, Aleppo',
    tenant: 'Aman Relief',
    tone: 'interview',
    status: 'Interview',
  },
  { job: 'Logistics Assistant', tenant: 'Hand in Hand', tone: 'neutral', status: 'Submitted' },
  { job: 'MEAL Officer, Idlib', tenant: 'Violet Org', tone: 'negative', status: 'Not selected' },
];

/** Spelled out rather than interpolated, so Tailwind's scanner can see every class. */
const SURFACES: [label: string, swatch: string][] = [
  ['background', 'bg-background'],
  ['card', 'bg-card'],
  ['muted', 'bg-muted'],
  ['accent', 'bg-accent'],
  ['primary', 'bg-primary'],
  ['secondary', 'bg-secondary'],
  ['destructive', 'bg-destructive'],
];

export default function KitchenSink() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 md:px-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Kitchen sink" description="Every primitive, both themes." />
        <ThemeToggle />
      </div>

      <Section title="Surfaces">
        {SURFACES.map(([label, swatch]) => (
          <div key={label} className="space-y-1.5">
            <div className={`size-16 rounded-lg border border-border ${swatch}`} />
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </Section>

      <Section title="Type">
        <div className="w-full space-y-3">
          <p className="font-heading text-h2 text-foreground">Syria's jobs, in one clear place.</p>
          <p className="font-heading text-h3 text-foreground">A section heading</p>
          <p className="text-foreground">
            Reading size, sixteen pixels — the candidate portal's body text.
          </p>
          <p className="text-dense text-muted-foreground">Dense size, for meta and captions.</p>
        </div>
      </Section>

      <Section title="Buttons">
        <Button>Apply now</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Delete account</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Forms">
        <ApplicationForm />
      </Section>

      <Section title="Feedback">
        <div className="w-full space-y-3">
          <Alert>
            <Info />
            <AlertTitle>Your CV is still being read</AlertTitle>
            <AlertDescription>
              You can keep browsing — we'll tell you when the draft is ready.
            </AlertDescription>
          </Alert>
          <SkeletonText lines={3} />
        </div>
      </Section>

      <Section title="Status chips">
        {STATUS_TONES.map((tone) => (
          <StatusChip key={tone} tone={tone} label={tone} />
        ))}
      </Section>

      <Section title="Lists">
        <div className="w-full divide-y divide-border border-t border-border">
          {APPLICATIONS.map(({ job, tenant, tone, status }) => (
            <div key={job} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{job}</p>
                <p className="truncate text-dense text-muted-foreground">{tenant}</p>
              </div>
              <StatusChip tone={tone} label={status} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Empty and loading">
        <div className="w-full space-y-5">
          <EmptyState
            icon={Search}
            message="No applications yet — find a job you like and apply."
            action={<Button>Browse jobs</Button>}
          />
          <ListSkeleton rows={3} />
        </div>
      </Section>
    </div>
  );
}
