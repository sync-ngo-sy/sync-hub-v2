import { SkeletonText } from '@sync/ui/components/skeletons';
import { TenantLogo } from '@sync/ui/components/tenant-logo';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sync/ui/components/ui/card';
import { Info } from 'lucide-react';
import { useMembers } from '@/features/team/hooks/use-members';
import { isTenantAdmin } from '@/features/team/member';
import { useMyTenant } from '../hooks/use-my-tenant';
import { TenantLogoPicker } from './tenant-logo-picker';

export function WorkspaceIdentity({ profileId }: { profileId: string }) {
  const { data: tenant, isPending } = useMyTenant();
  const members = useMembers();
  const mayAdminister = members.data ? isTenantAdmin(members.data, profileId) : members.isError;

  return (
    <Card className="mt-4 max-w-xl">
      <CardHeader>
        <CardTitle>Your Tenant</CardTitle>
        <CardDescription>
          Sync Hub opened your Tenant and keeps its name and address. Ask us to change either. The
          logo is yours to set, and Candidates see it wherever one of your Jobs appears.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending || !tenant ? (
          <SkeletonText lines={2} />
        ) : (
          <div className="space-y-6">
            <dl className="space-y-4">
              <div className="space-y-1">
                <dt className="text-meta text-muted-foreground">Name</dt>
                <dd className="text-foreground">{tenant.name}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-meta text-muted-foreground">Address</dt>
                <dd className="text-foreground">{tenant.slug}</dd>
              </div>
              <div className="space-y-2">
                <dt className="text-meta text-muted-foreground">Logo</dt>
                <dd>
                  {mayAdminister ? (
                    <TenantLogoPicker name={tenant.name} logoUrl={tenant.logo_url ?? null} />
                  ) : (
                    <TenantLogo name={tenant.name} logoUrl={tenant.logo_url} size="lg" />
                  )}
                </dd>
              </div>
            </dl>

            {members.isSuccess && !mayAdminister ? (
              <Alert>
                <Info aria-hidden="true" />
                <AlertTitle>The logo is an admin's to set</AlertTitle>
                <AlertDescription>
                  Ask one of your admins to upload it, and it appears here.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
