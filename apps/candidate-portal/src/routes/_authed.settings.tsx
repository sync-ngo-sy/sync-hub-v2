import { PageHeader } from '@sync/ui/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sync/ui/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';
import { DeleteAccountDialog } from '../features/account/components/delete-account-dialog';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
});

function AccountField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function SettingsPage() {
  const { profile } = Route.useRouteContext();
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-8">
      <PageHeader title="Account settings" description="Your account details and controls." />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <AccountField label="Name" value={profile.full_name} />
            <AccountField label="Email" value={profile.email} />
            <AccountField label="Phone" value={profile.phone ?? 'Not provided'} />
          </dl>
        </CardContent>
      </Card>

      <Card className="ring-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive-foreground">Danger zone</CardTitle>
          <CardDescription>
            Deleting your account is permanent. Take your time — this can't be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </div>
  );
}
