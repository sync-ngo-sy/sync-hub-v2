import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { Button } from '@sync/ui/components/ui/button';
import { Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useTagVocabulary } from '../hooks/use-tag-vocabulary';
import { SCOPE_LABELS, type Tag } from '../tag';
import { AddTagDialog } from './add-tag-dialog';
import { DeleteTagDialog } from './delete-tag-dialog';
import { RenameTagDialog } from './rename-tag-dialog';

const COLUMNS: DataTableColumn<Tag>[] = [
  { accessorKey: 'name', header: 'Tag' },
  {
    accessorKey: 'scope',
    header: 'Files',
    cell: ({ row }) => SCOPE_LABELS[row.original.scope],
  },
  {
    accessorKey: 'created_at',
    header: 'Added',
    cell: ({ row }) => (
      <time dateTime={row.original.created_at} title={absoluteDateTime(row.original.created_at)}>
        {relativeTime(row.original.created_at)}
      </time>
    ),
  },
];

export function TagVocabulary() {
  const vocabulary = useTagVocabulary();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const tags = vocabulary.data ?? [];
  const listedNothing = vocabulary.isSuccess && tags.length === 0;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-prose text-dense text-muted-foreground">
          The words your team files Candidates and Applications under. Renaming one keeps everything
          already filed under it; deleting one unfiles it everywhere.
        </p>
        {listedNothing ? null : (
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add a Tag
          </Button>
        )}
      </div>

      <DataTable
        label="Tags"
        columns={COLUMNS}
        data={tags}
        getRowId={(tag) => tag.id}
        rowLabel={(tag) => tag.name}
        rowActions={(tag) => [
          { label: 'Rename Tag', onSelect: () => setRenaming(tag) },
          { label: 'Delete Tag', onSelect: () => setDeleting(tag) },
        ]}
        isLoading={vocabulary.isPending}
        error={
          vocabulary.isError
            ? {
                message: problemMessage(vocabulary.error, "Couldn't load your Tenant's Tags."),
                onRetry: () => void vocabulary.refetch(),
              }
            : undefined
        }
        empty={{
          icon: Tags,
          message:
            'No Tags yet — add the first word your team will file Candidates and Applications under.',
          action: <Button onClick={() => setAdding(true)}>Add the first Tag</Button>,
        }}
      />

      <AddTagDialog vocabulary={tags} open={adding} onOpenChange={setAdding} />
      {renaming ? (
        <RenameTagDialog vocabulary={tags} tag={renaming} onClose={() => setRenaming(null)} />
      ) : null}
      {deleting ? <DeleteTagDialog tag={deleting} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}
