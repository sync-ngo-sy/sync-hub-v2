import { EmptyState } from '@sync/ui/components/empty-state';
import { FormField } from '@sync/ui/components/form-field';
import { PageHeader } from '@sync/ui/components/page-header';
import { CardSkeleton, SkeletonText, StatCardSkeleton } from '@sync/ui/components/skeletons';
import { StatCard } from '@sync/ui/components/stat-card';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { Input } from '@sync/ui/components/ui/input';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { useForm } from 'react-hook-form';

export const Route = createFileRoute('/dev-kitchen-sink')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: KitchenSinkPage,
});

function ButtonsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Buttons</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </CardContent>
    </Card>
  );
}

function FormSection() {
  const form = useForm({ defaultValues: { sample: '' } });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Form field</CardTitle>
      </CardHeader>
      <CardContent>
        <FormField control={form.control} name="sample" label="Sample field" description="A hint">
          {(field) => <Input {...field} placeholder="Type here" />}
        </FormField>
      </CardContent>
    </Card>
  );
}

function DropdownSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dropdown menu</CardTitle>
      </CardHeader>
      <CardContent>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline">Open menu</Button>} />
          <DropdownMenuContent>
            <DropdownMenuItem>First action</DropdownMenuItem>
            <DropdownMenuItem>Second action</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function KitchenSinkPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Kitchen sink" description="Dev-only sample of @sync/ui — never shipped." />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Open Jobs"
          value={12}
          trend={{ label: '+2 this week', tone: 'positive' }}
        />
        <StatCardSkeleton />
      </div>
      <ButtonsSection />
      <FormSection />
      <DropdownSection />
      <EmptyState icon={<Inbox />} title="Nothing here yet" description="An example empty state." />
      <CardSkeleton />
      <SkeletonText lines={2} />
    </div>
  );
}
