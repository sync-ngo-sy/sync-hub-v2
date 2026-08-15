import { zodResolver } from '@hookform/resolvers/zod';
import { CandidateCard } from '@sync/ui/components/candidate-card';
import {
  Combobox,
  type ComboboxOption,
  type ComboboxOptionGroup,
} from '@sync/ui/components/combobox';
import { EmptyState } from '@sync/ui/components/empty-state';
import { FormField } from '@sync/ui/components/form-field';
import { PageHeader } from '@sync/ui/components/page-header';
import { ListSkeleton, SkeletonText } from '@sync/ui/components/skeletons';
import { STATUS_TONES, StatusMark, type StatusTone } from '@sync/ui/components/status-mark';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { Info, Search, Trash2 } from 'lucide-react';
import { type ReactNode, useId } from 'react';
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

const SKILLS: ComboboxOption[] = [
  { value: 'meal', label: 'Monitoring, Evaluation, Accountability and Learning' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'protection', label: 'Protection' },
  { value: 'wash', label: 'Water, Sanitation and Hygiene' },
  { value: 'health', label: 'Health' },
];

const LANGUAGES: ComboboxOption[] = [
  { value: 'ar', label: 'Arabic' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'ku', label: 'Kurdish' },
  { value: 'tr', label: 'Turkish' },
];

const LOCATIONS: ComboboxOptionGroup[] = [
  {
    label: 'North-west',
    options: [
      { value: 'idlib', label: 'Idlib' },
      { value: 'aleppo', label: 'Aleppo' },
    ],
  },
  {
    label: 'Coast',
    options: [
      { value: 'latakia', label: 'Latakia' },
      { value: 'tartus', label: 'Tartus' },
    ],
  },
  {
    label: 'South',
    options: [
      { value: 'damascus', label: 'Damascus' },
      { value: 'daraa', label: 'Daraa' },
    ],
  },
];

function Pickers() {
  const skillId = useId();
  const languagesId = useId();
  const locationId = useId();
  const arrivingId = useId();

  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={skillId}>Main skill</Label>
        <Combobox
          id={skillId}
          options={SKILLS}
          placeholder="Search skills"
          emptyMessage="No skill by that name."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={languagesId}>Languages you speak</Label>
        <Combobox
          multiple
          id={languagesId}
          options={LANGUAGES}
          defaultValue={['ar', 'en']}
          placeholder="Add a language"
          emptyMessage="No language by that name."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={locationId}>Where you can work</Label>
        <Combobox
          id={locationId}
          options={LOCATIONS}
          placeholder="Search locations"
          emptyMessage="No location by that name."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={arrivingId}>Still arriving</Label>
        <Combobox id={arrivingId} options={[]} loading loadingMessage="Loading skills…" />
      </div>
    </div>
  );
}

interface DemoApplication {
  job: string;
  tenant: string;
  tone: StatusTone;
  status: string;
}

const APPLICATIONS: DemoApplication[] = [
  {
    job: 'Field Coordinator, Aleppo',
    tenant: 'Aman Relief',
    tone: 'interview',
    status: 'Interview',
  },
  { job: 'Logistics Assistant', tenant: 'Hand in Hand', tone: 'new', status: 'Submitted' },
  { job: 'MEAL Officer, Idlib', tenant: 'Violet Org', tone: 'rejected', status: 'Not selected' },
];

const SURFACES: [label: string, swatch: string][] = [
  ['background', 'bg-background'],
  ['card', 'bg-card'],
  ['muted', 'bg-muted'],
  ['interactive hover', 'bg-interactive-hover'],
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

      <section className="space-y-3">
        <h2 className="font-heading text-h3 text-foreground">Candidate card</h2>
        <CandidateCard
          name="Lina Khoury"
          avatarUrl={null}
          email="lina@example.test"
          phone="+963 11 555 0100"
          canonicalRole="Project Manager"
          headline="Runs delivery for two field programmes"
          headingLevel={2}
          facts={[
            { label: 'Total experience', value: '6 years' },
            { label: 'Languages', value: 'Arabic, English' },
          ]}
        />
      </section>

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
        <Button variant="destructive-outline">
          <Trash2 data-icon="inline-start" />
          Delete CV
        </Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Forms">
        <ApplicationForm />
      </Section>

      <Section title="Pickers">
        <Pickers />
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

      <Section title="Status marks">
        {STATUS_TONES.map((tone) => (
          <StatusMark key={tone} tone={tone} label={tone} />
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
              <StatusMark tone={tone} label={status} />
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
