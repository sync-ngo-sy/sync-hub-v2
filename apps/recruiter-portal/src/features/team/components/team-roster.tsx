import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { StatusMark } from '@sync/ui/components/status-mark';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Badge } from '@sync/ui/components/ui/badge';
import { Button } from '@sync/ui/components/ui/button';
import { Info, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { problemMessage } from '@/lib/api-problem';
import { useMembers } from '../hooks/use-members';
import {
  isTenantAdmin,
  type Member,
  type MemberChange,
  memberAccess,
  memberChanges,
  ROLE_LABELS,
} from '../member';
import { InviteTeammateDialog } from './invite-teammate-dialog';
import { MemberChangeDialog } from './member-change-dialog';

function columns(profileId: string): DataTableColumn<Member>[] {
  return [
    {
      accessorKey: 'full_name',
      header: 'Member',
      meta: { share: 3 },
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          <TruncatedText>{row.original.full_name}</TruncatedText>
          {row.original.id === profileId ? (
            <Badge variant="outline" size="sm">
              You
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      meta: { share: 4 },
      cell: ({ row }) => (
        <TruncatedText className="font-normal text-muted-foreground">
          {row.original.email}
        </TruncatedText>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => ROLE_LABELS[row.original.role],
    },
    {
      accessorKey: 'is_active',
      header: 'Access',
      cell: ({ row }) => {
        const access = memberAccess(row.original);
        return <StatusMark label={access.label} tone={access.tone} />;
      },
    },
  ];
}

interface Asking {
  member: Member;
  change: MemberChange;
}

export function TeamRoster({ profileId }: { profileId: string }) {
  const members = useMembers();
  const [inviting, setInviting] = useState(false);
  const [asking, setAsking] = useState<Asking | null>(null);

  const roster = members.data ?? [];
  const mayAdminister = isTenantAdmin(roster, profileId);

  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-prose text-dense text-muted-foreground">
          Everyone your Tenant has on its roster, colleagues without access included.
        </p>
        {mayAdminister ? (
          <Button onClick={() => setInviting(true)}>
            <UserPlus aria-hidden="true" />
            Invite teammate
          </Button>
        ) : null}
      </div>

      {members.isSuccess && !mayAdminister ? (
        <Alert>
          <Info aria-hidden="true" />
          <AlertTitle>The roster is yours to read</AlertTitle>
          <AlertDescription>
            Only an admin can invite a teammate or change what a colleague may do. Ask one of yours.
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        label="Team"
        columns={columns(profileId)}
        data={roster}
        getRowId={(member) => member.id}
        rowLabel={(member) => member.full_name}
        rowActions={(member) =>
          mayAdminister
            ? memberChanges(member, profileId).map((change) => ({
                label: change.label,
                onSelect: () => setAsking({ member, change }),
              }))
            : []
        }
        isLoading={members.isPending}
        error={
          members.isError
            ? {
                message: problemMessage(members.error, "Couldn't load your Tenant's roster."),
                onRetry: () => void members.refetch(),
              }
            : undefined
        }
        empty={{
          icon: UserPlus,
          message: 'Nobody is on the roster yet — invite the first teammate.',
          action: mayAdminister ? (
            <Button onClick={() => setInviting(true)}>Invite the first teammate</Button>
          ) : null,
        }}
      />

      <InviteTeammateDialog open={inviting} onOpenChange={setInviting} />
      {asking ? (
        <MemberChangeDialog
          member={asking.member}
          change={asking.change}
          onClose={() => setAsking(null)}
        />
      ) : null}
    </div>
  );
}
