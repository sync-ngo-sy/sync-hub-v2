import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { StatusMark } from '@sync/ui/components/status-mark';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Button } from '@sync/ui/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import { CreateTenantDialog } from './create-tenant-dialog';
import { type PlatformTenant, tenantPlanLabel } from './tenant';
import { platformTenantsQuery, useResendFoundingAdminInvite } from './tenant-queries';
import { TenantStatusDialog } from './tenant-status-dialog';

const tenantColumns: DataTableColumn<PlatformTenant>[] = [
  {
    accessorKey: 'name',
    header: 'Tenant',
    meta: { share: 3 },
    cell: ({ row }) => <TruncatedText>{row.original.name}</TruncatedText>,
  },
  {
    accessorKey: 'slug',
    header: 'Address',
    meta: { priority: 'hidden', share: 3 },
    cell: ({ row }) => <TruncatedText>{row.original.slug}</TruncatedText>,
  },
  { accessorKey: 'plan', header: 'Plan', cell: ({ row }) => tenantPlanLabel(row.original.plan) },
  { accessorKey: 'member_count', header: 'Members' },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <StatusMark
        tone={row.original.is_active ? 'active' : 'ended'}
        label={row.original.is_active ? 'Active' : 'Suspended'}
      />
    ),
  },
  {
    id: 'invitation',
    header: 'Invitation',
    cell: ({ row }) =>
      row.original.invite_pending ? (
        <StatusMark tone="attention" label="Invite pending" />
      ) : (
        <StatusMark tone="active" label="Accepted" />
      ),
  },
];

export function PlatformTenants() {
  const tenants = useQuery(platformTenantsQuery);
  const resendInvite = useResendFoundingAdminInvite();
  const resendInFlight = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusTenant, setStatusTenant] = useState<PlatformTenant | null>(null);
  const createButton = <Button onClick={() => setCreateOpen(true)}>Create tenant</Button>;

  async function resend(tenant: PlatformTenant) {
    if (resendInFlight.current || resendInvite.isPending) return;
    resendInFlight.current = true;
    try {
      await resendInvite.mutateAsync({ params: { path: { tenant_id: tenant.id } } });
      toast.success(`Invitation resent for ${tenant.name}.`);
    } catch (error) {
      toast.error(problemMessage(error, `The invitation for ${tenant.name} couldn't be resent.`));
    } finally {
      resendInFlight.current = false;
    }
  }

  return (
    <section>
      <PageHeader
        title="Tenants"
        description="Manage tenant access, invitations and platform records. Tenant plans are display-only."
        actions={createButton}
      />
      <DataTable
        label="Platform tenants"
        columns={tenantColumns}
        data={tenants.data ?? []}
        getRowId={(tenant) => tenant.id}
        rowLabel={(tenant) => tenant.name}
        rowActions={(tenant) => [
          ...(tenant.invite_pending && !resendInvite.isPending
            ? [{ label: 'Resend invite', onSelect: () => void resend(tenant) }]
            : []),
          {
            label: tenant.is_active ? 'Suspend tenant' : 'Restore tenant',
            onSelect: () => setStatusTenant(tenant),
          },
        ]}
        isLoading={tenants.isPending}
        error={
          tenants.isError
            ? {
                message: problemMessage(tenants.error, "Couldn't load tenants."),
                onRetry: () => void tenants.refetch(),
              }
            : undefined
        }
        empty={{
          icon: Building2,
          message: 'No tenants have been opened yet.',
          action: createButton,
        }}
        className="mt-8"
      />
      <CreateTenantDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TenantStatusDialog tenant={statusTenant} onClose={() => setStatusTenant(null)} />
    </section>
  );
}
