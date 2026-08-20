import { PageHeader } from '@sync/ui/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sync/ui/components/ui/card';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import type { Profile } from '../current-profile';
import { ChangePasswordForm } from './change-password-form';

export function AccountSettingsPage({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-(--space-section)">
      <WorkspaceHeader>
        <PageHeader
          title="Account settings"
          description="The details attached to your own Sync Hub account, not your Tenant's."
        />
      </WorkspaceHeader>

      <Card>
        <CardHeader>
          <CardTitle>Account information</CardTitle>
          <CardDescription>This is the identity you use to sign in to Sync Hub.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-meta font-medium text-muted-foreground">Full name</dt>
              <dd className="text-foreground">{profile.full_name}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-meta font-medium text-muted-foreground">Email</dt>
              <dd className="break-all text-foreground">{profile.email}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Choose a new password for signing in to Sync Hub.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
