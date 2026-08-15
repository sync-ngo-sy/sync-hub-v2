import {
  Combobox,
  type ComboboxOption,
  type ComboboxOptionGroup,
} from '@sync/ui/components/combobox';
import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PhoneField, type PhoneValue } from '@sync/ui/components/phone-field';
import { STATUS_TONES, StatusMark, type StatusTone } from '@sync/ui/components/status-mark';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Avatar, AvatarFallback } from '@sync/ui/components/ui/avatar';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { Switch } from '@sync/ui/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sync/ui/components/ui/tabs';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { Inbox, Info } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { PageHeader } from '@/features/shell/components/page-header';
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

interface DemoApplication {
  id: string;
  candidate: string;
  job: string;
  screening: { tone: StatusTone; label: string };
  stage: { tone: StatusTone; label: string };
}

const APPLICATIONS: DemoApplication[] = [
  {
    id: 'a1',
    candidate: 'Lina Khoury',
    job: 'Field Coordinator, Aleppo',
    screening: { tone: 'active', label: 'Qualified' },
    stage: { tone: 'interview', label: 'Interview' },
  },
  {
    id: 'a2',
    candidate: 'Yara Salloum',
    job: 'Logistics Assistant',
    screening: { tone: 'ended', label: 'Disqualified' },
    stage: { tone: 'rejected', label: 'Rejected' },
  },
  {
    id: 'a3',
    candidate: 'Omar Haddad',
    job: 'MEAL Officer, Idlib',
    screening: { tone: 'attention', label: 'Review required' },
    stage: { tone: 'new', label: 'New' },
  },
  {
    id: 'a4',
    candidate: 'Rana Deeb',
    job: 'Programme Manager',
    screening: { tone: 'active', label: 'Qualified' },
    stage: { tone: 'hired', label: 'Hired' },
  },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('');
}

const APPLICATION_COLUMNS: DataTableColumn<DemoApplication>[] = [
  {
    accessorKey: 'candidate',
    header: 'Candidate',
    meta: { share: 3 },
    cell: ({ row }) => (
      <span className="flex items-center gap-2.5">
        <Avatar size="row">
          <AvatarFallback>{initials(row.original.candidate)}</AvatarFallback>
        </Avatar>
        {row.original.candidate}
      </span>
    ),
  },
  {
    accessorKey: 'job',
    header: 'Job',
    meta: { width: '25ch' },
    cell: ({ row }) => <TruncatedText>{row.original.job}</TruncatedText>,
  },
  {
    id: 'screening',
    header: 'Screening',
    cell: ({ row }) => <StatusMark {...row.original.screening} />,
  },
  {
    id: 'stage',
    header: 'Status',
    cell: ({ row }) => <StatusMark {...row.original.stage} />,
  },
];

function ApplicationsTable() {
  const [shown, setShown] = useState(2);

  return (
    <DataTable
      label="Applications"
      columns={APPLICATION_COLUMNS}
      data={APPLICATIONS.slice(0, shown)}
      getRowId={(application) => application.id}
      rowLabel={(application) => application.candidate}
      onRowOpen={(application) => console.info('open', application.id)}
      rowActions={(application) => [
        { label: 'Move to shortlist', onSelect: () => console.info('shortlist', application.id) },
        { label: 'Reject', onSelect: () => console.info('reject', application.id) },
      ]}
      empty={{
        icon: Inbox,
        message: 'No applications yet — publish a job and they will land here.',
        action: <Button>Create job</Button>,
      }}
      loadMore={{
        hasMore: shown < APPLICATIONS.length,
        onLoadMore: () => setShown(APPLICATIONS.length),
      }}
    />
  );
}

const FUNCTIONS: ComboboxOption[] = [
  { value: 'meal', label: 'Monitoring, Evaluation, Accountability and Learning' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'protection', label: 'Protection' },
  { value: 'wash', label: 'Water, Sanitation and Hygiene' },
  { value: 'finance', label: 'Finance' },
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

function PhoneEntry() {
  const phoneId = useId();
  const [phone, setPhone] = useState<PhoneValue>({ country: 'SY', number: '011 555 0100' });

  return (
    <div className="space-y-1.5">
      <Label htmlFor={phoneId}>Phone</Label>
      <PhoneField id={phoneId} value={phone} onChange={setPhone} />
    </div>
  );
}

function Pickers() {
  const functionId = useId();
  const languagesId = useId();
  const stationId = useId();
  const arrivingId = useId();

  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={functionId}>Job function</Label>
        <Combobox
          id={functionId}
          options={FUNCTIONS}
          placeholder="Search functions"
          emptyMessage="No function by that name."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={languagesId}>Languages required</Label>
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
        <Label htmlFor={stationId}>Duty station</Label>
        <Combobox
          id={stationId}
          options={LOCATIONS}
          placeholder="Search locations"
          emptyMessage="No location by that name."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={arrivingId}>Still arriving</Label>
        <Combobox id={arrivingId} options={[]} loading loadingMessage="Loading functions…" />
      </div>
    </div>
  );
}

const SURFACES: [label: string, swatch: string][] = [
  ['background', 'bg-background'],
  ['card', 'bg-card'],
  ['input', 'bg-input-background'],
  ['muted', 'bg-muted'],
  ['interactive hover', 'bg-interactive-hover'],
  ['accent', 'bg-accent'],
  ['primary', 'bg-primary'],
  ['secondary', 'bg-secondary'],
  ['deep', 'bg-deep'],
  ['sidebar', 'bg-sidebar'],
  ['destructive', 'bg-destructive'],
];

const STATUSES: [label: string, swatch: string][] = [
  ['new', 'bg-status-new'],
  ['review', 'bg-status-review'],
  ['shortlisted', 'bg-status-shortlisted'],
  ['interview', 'bg-status-interview'],
  ['offer', 'bg-status-offer'],
  ['hired', 'bg-status-hired'],
  ['rejected', 'bg-status-rejected'],
  ['withdrawn', 'bg-status-withdrawn'],
];

export default function KitchenSink() {
  const emailId = useId();
  const noteId = useId();
  const remoteId = useId();
  const searchableId = useId();

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-5 py-10">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Kitchen sink" subtitle="Every primitive, both themes." />
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

      <Section title="Status colours">
        {STATUSES.map(([label, swatch]) => (
          <div key={label} className="space-y-1.5">
            <div className={`size-8 rounded-sm ${swatch}`} />
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </Section>

      <Section title="Buttons">
        <Button>Create job</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <span className="rounded-lg bg-sidebar p-2">
          <Button variant="sidebar">Sidebar</Button>
        </span>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Delete workspace</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Forms">
        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={emailId}>Email</Label>
            <Input id={emailId} type="email" placeholder="rana@aman.test" />
          </div>
          <PhoneEntry />
          <div className="space-y-1.5">
            <Label htmlFor={noteId}>Note</Label>
            <Textarea id={noteId} placeholder="Strong MEAL background." />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={remoteId} />
            <Label htmlFor={remoteId}>Remote allowed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={searchableId} />
            <Label htmlFor={searchableId}>Searchable</Label>
          </div>
        </div>
      </Section>

      <Section title="Pickers">
        <Pickers />
      </Section>

      <Section title="Feedback">
        <div className="w-full space-y-3">
          <Alert>
            <Info />
            <AlertTitle>Screening criteria are locked</AlertTitle>
            <AlertDescription>
              A published job keeps the criteria it was published with.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </Section>

      <Section title="Status marks">
        {STATUS_TONES.map((tone) => (
          <StatusMark key={tone} tone={tone} label={tone} />
        ))}
      </Section>

      <Section title="Lists">
        <Tabs defaultValue="applications" className="w-full">
          <TabsList>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="criteria">Screening criteria</TabsTrigger>
          </TabsList>
          <TabsContent value="applications">
            <Card>
              <CardHeader>
                <CardTitle>Recent applications</CardTitle>
              </CardHeader>
              <CardContent>
                <ApplicationsTable />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="criteria">
            <Card>
              <CardContent className="py-6 text-dense text-muted-foreground">
                Criteria land with the Job detail ticket.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Section>
    </div>
  );
}
