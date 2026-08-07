import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { Button } from '@sync/ui/components/ui/button';
import { MailPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useMessageTemplates } from '../hooks/use-message-templates';
import type { MessageTemplate } from '../message-template';
import { CreateTemplateDialog } from './create-template-dialog';
import { DeleteTemplateDialog } from './delete-template-dialog';
import { EditTemplateDialog } from './edit-template-dialog';

function opening(body: string): string {
  const [first = ''] = body.split('\n');
  return first.length > 120 ? `${first.slice(0, 120).trimEnd()}…` : first;
}

const COLUMNS: DataTableColumn<MessageTemplate>[] = [
  {
    accessorKey: 'name',
    header: 'Template',
    cell: ({ row }) => (
      <span className="flex min-w-52 flex-col gap-1">
        <span>{row.original.name}</span>
        <span className="text-meta font-normal text-muted-foreground">
          {opening(row.original.body)}
        </span>
      </span>
    ),
  },
  {
    accessorKey: 'subject',
    header: 'Subject',
    cell: ({ row }) => <span className="flex min-w-52">{row.original.subject}</span>,
  },
  {
    accessorKey: 'updated_at',
    header: 'Updated',
    cell: ({ row }) => (
      <time dateTime={row.original.updated_at} title={absoluteDateTime(row.original.updated_at)}>
        {relativeTime(row.original.updated_at)}
      </time>
    ),
  },
];

export function MessageTemplatesPage() {
  const templates = useMessageTemplates();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null);

  return (
    <div className="space-y-(--space-section)">
      <PageHeader
        title="Templates"
        description="The Message templates your Recruiters reuse when they write an applicant."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Create template
          </Button>
        }
      />

      <DataTable
        label="Message templates"
        columns={COLUMNS}
        data={templates.data ?? []}
        getRowId={(template) => template.id}
        rowLabel={(template) => template.name}
        rowActions={(template) => [
          { label: 'Edit template', onSelect: () => setEditing(template) },
          { label: 'Delete template', onSelect: () => setDeleting(template) },
        ]}
        isLoading={templates.isPending}
        empty={{
          icon: MailPlus,
          message: 'No Message templates yet — write the first one your Recruiters will reuse.',
          action: <Button onClick={() => setCreating(true)}>Create your first template</Button>,
        }}
      />

      <CreateTemplateDialog open={creating} onOpenChange={setCreating} />
      {editing ? (
        <WidgetBoundary name="Edit template">
          <EditTemplateDialog
            templateId={editing.id}
            open
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
          />
        </WidgetBoundary>
      ) : null}
      <DeleteTemplateDialog template={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
