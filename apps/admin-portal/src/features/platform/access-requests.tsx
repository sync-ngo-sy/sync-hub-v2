import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { problemMessage } from '@/lib/api-problem';
import { type AccessRequest, askedOn } from './access-request';
import { accessRequestsQuery } from './access-request-queries';
import { ConvertRequestDialog } from './convert-request-dialog';
import { DismissRequestDialog } from './dismiss-request-dialog';

export const ACCESS_REQUEST_COLUMNS: DataTableColumn<AccessRequest>[] = [
  {
    accessorKey: 'company',
    header: 'Company',
    meta: { share: 3 },
    cell: ({ row }) => <TruncatedText>{row.original.company}</TruncatedText>,
  },
  {
    accessorKey: 'full_name',
    header: 'Asked by',
    meta: { share: 3 },
    cell: ({ row }) => <TruncatedText>{row.original.full_name}</TruncatedText>,
  },
  {
    accessorKey: 'email',
    header: 'Email',
    meta: { share: 4 },
    cell: ({ row }) => <TruncatedText>{row.original.email}</TruncatedText>,
  },
  { id: 'asked', header: 'Asked', cell: ({ row }) => askedOn(row.original.created_at) },
];

export function AccessRequests() {
  const requests = useQuery(accessRequestsQuery);
  const [converting, setConverting] = useState<AccessRequest | null>(null);
  const [dismissing, setDismissing] = useState<AccessRequest | null>(null);

  return (
    <section>
      <PageHeader
        title="Access requests"
        description="Companies asking to be let onto Sync Hub, oldest first. Convert one into a tenant, or dismiss it."
      />
      <DataTable
        label="Access requests"
        columns={ACCESS_REQUEST_COLUMNS}
        data={requests.data ?? []}
        getRowId={(request) => request.id}
        rowLabel={(request) => request.company}
        rowActions={(request) => [
          { label: 'Convert to tenant', onSelect: () => setConverting(request) },
          { label: 'Dismiss request', onSelect: () => setDismissing(request), destructive: true },
        ]}
        isLoading={requests.isPending}
        error={
          requests.isError
            ? {
                message: problemMessage(requests.error, "Couldn't load access requests."),
                onRetry: () => void requests.refetch(),
              }
            : undefined
        }
        empty={{
          icon: Inbox,
          message: 'Nobody is waiting for access.',
          action: (
            <Link to="/tenants" className={buttonVariants({ variant: 'outline' })}>
              Open a tenant by hand
            </Link>
          ),
        }}
        className="mt-8"
      />
      <ConvertRequestDialog request={converting} onClose={() => setConverting(null)} />
      <DismissRequestDialog request={dismissing} onClose={() => setDismissing(null)} />
    </section>
  );
}
