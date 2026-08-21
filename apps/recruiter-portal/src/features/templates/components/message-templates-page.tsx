import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Button } from '@sync/ui/components/ui/button';
import { MailPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useMessageTemplates } from '../hooks/use-message-templates';
import type { MessageTemplate } from '../message-template';
import { CreateTemplateDialog } from './create-template-dialog';
import { DeleteTemplateDialog } from './delete-template-dialog';
import { EditTemplateDialog } from './edit-template-dialog';

export const TEMPLATE_COLUMNS: DataTableColumn<MessageTemplate>[] = [
  {
    accessorKey: 'name',
    header: 'Template',
    meta: { share: 3 },
    cell: ({ row }) => <TruncatedText>{row.original.name}</TruncatedText>,
  },
  {
    accessorKey: 'subject',
    header: 'Subject',
    meta: { share: 5 },
    cell: ({ row }) => <TruncatedText>{row.original.subject}</TruncatedText>,
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
    <>
      <WorkspaceHeader>
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
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <DataTable
          label="Message templates"
          columns={TEMPLATE_COLUMNS}
          data={templates.data ?? []}
          getRowId={(template) => template.id}
          rowLabel={(template) => template.name}
          rowActions={(template) => [
            { label: 'Edit template', onSelect: () => setEditing(template) },
            { label: 'Delete template', onSelect: () => setDeleting(template), destructive: true },
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
    </>
  );
}
