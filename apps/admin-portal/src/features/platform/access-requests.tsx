import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
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

const requestColumns: DataTableColumn<AccessRequest>[] = [
  { accessorKey: 'company', header: 'Company', meta: { share: 3 } },
  { accessorKey: 'full_name', header: 'Asked by', meta: { share: 3 } },
  { accessorKey: 'email', header: 'Email', meta: { share: 4 } },
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
        columns={requestColumns}
        data={requests.data ?? []}
        getRowId={(request) => request.id}
        rowLabel={(request) => request.company}
        rowActions={(request) => [
          { label: 'Convert to tenant', onSelect: () => setConverting(request) },
          { label: 'Dismiss request', onSelect: () => setDismissing(request) },
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
