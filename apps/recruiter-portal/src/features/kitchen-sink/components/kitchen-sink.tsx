import { DataTable } from '@sync/ui/components/data-table';
import { EmptyState } from '@sync/ui/components/empty-state';
import { FormField } from '@sync/ui/components/form-field';
import { PageHeader } from '@sync/ui/components/page-header';
import { CardSkeleton, SkeletonText, StatCardSkeleton } from '@sync/ui/components/skeletons';
import { StatCard } from '@sync/ui/components/stat-card';
import { type ChipStatus, StatusChip } from '@sync/ui/components/status-chip';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader } from '@sync/ui/components/ui/card';
import { Input } from '@sync/ui/components/ui/input';
import { Inbox, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ErrorCard } from '@/features/shell/components/error-card';
import { ThemeToggle } from '@/features/shell/components/theme-toggle';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';

const STATUSES: ChipStatus[] = [
  'new',
  'reviewing',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
  'draft',
  'published',
  'closed',
  'archived',
  'pending',
  'qualified',
  'disqualified',
  'review_required',
];

const BUTTON_VARIANTS = [
  'default',
  'outline',
  'secondary',
  'ghost',
  'destructive',
  'link',
] as const;

interface DemoRow {
  id: string;
  candidate: string;
  job: string;
}

const DEMO_ROWS: DemoRow[] = [
  { id: '1', candidate: 'Lina Khoury', job: 'Field Coordinator, Aleppo' },
  { id: '2', candidate: 'Omar Nassar', job: 'MEAL Officer' },
];

/** Fails on sight, so the widget boundary beside it has something to catch. */
function ExplodingPanel(): ReactNode {
  throw new Error('Kitchen-sink panel failed on purpose');
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-h3 text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Default-exported so the route can reach it through a `lazy()` a production build drops. */
export default function KitchenSinkPage() {
  const form = useForm<{ email: string }>({ defaultValues: { email: '' } });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-5 py-10 lg:px-8">
      <PageHeader
        title="Kitchen sink"
        description="Every design-system piece this portal renders, in the active theme."
        actions={<ThemeToggle />}
      />

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Status chips">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <StatusChip key={status} status={status} />
          ))}
        </div>
      </Section>

      <Section title="Stats">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Open jobs"
            value={12}
            trend={{ label: '+2 since last week', tone: 'positive', icon: <TrendingUp /> }}
          />
          <StatCard
            label="Awaiting review"
            value={23}
            trend={{ label: 'Needs attention', tone: 'caution' }}
          />
          <StatCard label="Qualified by screening" value={61} trend={{ label: '78% pass rate' }} />
          <StatCardSkeleton />
        </div>
      </Section>

      <Section title="Form field">
        <Card>
          <CardContent>
            <FormField
              control={form.control}
              name="email"
              label="Email address"
              description="We never share it."
            >
              {(field) => <Input {...field} type="email" />}
            </FormField>
          </CardContent>
        </Card>
      </Section>

      <Section title="Table">
        <DataTable
          label="Demo applications"
          rows={DEMO_ROWS}
          getRowId={(row) => row.id}
          getRowName={(row) => row.candidate}
          columns={[
            { accessorKey: 'candidate', header: 'Candidate' },
            { accessorKey: 'job', header: 'Job' },
          ]}
          loadMore={{ hasMore: true, onLoadMore: () => toast('Loaded more') }}
          actions={[{ label: 'Open', onSelect: (row) => toast(row.candidate) }]}
        />
      </Section>

      <Section title="Empty, loading, error">
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            icon={<Inbox />}
            title="No applications yet"
            description="Publish a job and applications land here."
            action={<Button variant="outline">Create job</Button>}
          />
          <CardSkeleton />
          <Card>
            <CardHeader>
              <SkeletonText lines={2} />
            </CardHeader>
            <CardContent>
              <SkeletonText lines={3} />
            </CardContent>
          </Card>
          <ErrorCard onRetry={() => toast('Retried')} />
          <WidgetBoundary source="kitchen-sink" message="Couldn't load this panel.">
            <ExplodingPanel />
          </WidgetBoundary>
        </div>
      </Section>

      <Section title="Toasts">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast.success('Job published')}>
            Success
          </Button>
          <Button variant="outline" onClick={() => toast.error("Couldn't publish the job")}>
            Error
          </Button>
        </div>
      </Section>
    </div>
  );
}
