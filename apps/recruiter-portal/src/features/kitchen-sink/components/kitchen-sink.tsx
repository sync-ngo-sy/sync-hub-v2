import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Avatar, AvatarFallback } from '@sync/ui/components/ui/avatar';
import { Badge } from '@sync/ui/components/ui/badge';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { Separator } from '@sync/ui/components/ui/separator';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { Switch } from '@sync/ui/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sync/ui/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sync/ui/components/ui/tabs';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { Info } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { PageHeader } from '@/features/shell/components/page-header';
import { ThemeToggle } from '@/features/shell/components/theme-toggle';
import { StatusChip } from './status-chip';

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

/** Spelled out rather than interpolated, so Tailwind's scanner can see every class. */
const SURFACES: [label: string, swatch: string][] = [
  ['background', 'bg-background'],
  ['card', 'bg-card'],
  ['muted', 'bg-muted'],
  ['accent', 'bg-accent'],
  ['primary', 'bg-primary'],
  ['secondary', 'bg-secondary'],
  ['sidebar', 'bg-sidebar'],
  ['destructive', 'bg-destructive'],
];

/**
 * The dev-only gallery that stands in for Storybook: every primitive this portal composes
 * from, on one page, so both themes can be checked at a glance.
 */
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

      <Section title="Buttons">
        <Button>Create job</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Delete workspace</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Status chips">
        <StatusChip tone="qualified">Qualified</StatusChip>
        <StatusChip tone="shortlisted">Shortlisted</StatusChip>
        <StatusChip tone="interview">Interview</StatusChip>
        <StatusChip tone="offer">Offer</StatusChip>
        <StatusChip tone="hired">Hired</StatusChip>
        <StatusChip>New</StatusChip>
        <StatusChip>Reviewing</StatusChip>
        <StatusChip icon="attention">Review required</StatusChip>
        <StatusChip icon="negative">Disqualified</StatusChip>
        <StatusChip icon="negative">Rejected</StatusChip>
        <Separator orientation="vertical" className="h-6" />
        <Badge>Badge</Badge>
        <Badge variant="outline">Outline</Badge>
      </Section>

      <Section title="Forms">
        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={emailId}>Email</Label>
            <Input id={emailId} type="email" placeholder="rana@aman.test" />
          </div>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Screening</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>LK</AvatarFallback>
                          </Avatar>
                          Lina Khoury
                        </span>
                      </TableCell>
                      <TableCell>Field Coordinator, Aleppo</TableCell>
                      <TableCell>
                        <StatusChip tone="qualified">Qualified</StatusChip>
                      </TableCell>
                      <TableCell>
                        <StatusChip>New</StatusChip>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>YS</AvatarFallback>
                          </Avatar>
                          Yara Salloum
                        </span>
                      </TableCell>
                      <TableCell>Logistics Assistant</TableCell>
                      <TableCell>
                        <StatusChip icon="negative">Disqualified</StatusChip>
                      </TableCell>
                      <TableCell>
                        <StatusChip icon="negative">Rejected</StatusChip>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
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
