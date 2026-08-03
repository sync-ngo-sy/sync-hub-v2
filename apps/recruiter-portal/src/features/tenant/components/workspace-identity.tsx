import { SkeletonText } from '@sync/ui/components/skeletons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sync/ui/components/ui/card';
import { useMyTenant } from '../hooks/use-my-tenant';

export function WorkspaceIdentity() {
  const { data: tenant, isPending } = useMyTenant();

  return (
    <Card className="mt-4 max-w-xl">
      <CardHeader>
        <CardTitle>Your Tenant</CardTitle>
        <CardDescription>
          Sync opened your Tenant and keeps its name and address. Ask us to change either.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending || !tenant ? (
          <SkeletonText lines={2} />
        ) : (
          <dl className="space-y-4">
            <div className="space-y-1">
              <dt className="text-meta text-muted-foreground">Name</dt>
              <dd className="text-foreground">{tenant.name}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-meta text-muted-foreground">Address</dt>
              <dd className="text-foreground">{tenant.slug}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
