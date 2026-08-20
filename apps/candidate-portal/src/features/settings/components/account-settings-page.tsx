import { PageHeader } from '@sync/ui/components/page-header';
import { Button } from '@sync/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sync/ui/components/ui/card';
import { useState } from 'react';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import type { Profile } from '@/features/auth/current-profile';
import { DeleteAccountDialog } from './delete-account-dialog';

export function AccountSettingsPage({ profile }: { profile: Profile }) {
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);

  return (
    <div className="space-y-(--space-section)">
      <PageHeader
        title="Account settings"
        description="Review the details attached to your Sync Hub account."
      />

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

      <section
        className="space-y-4 border-t border-destructive/30 pt-8"
        aria-labelledby="danger-zone-title"
      >
        <div className="space-y-1">
          <h2 id="danger-zone-title" className="font-heading text-h3 text-destructive">
            Danger zone
          </h2>
          <p className="max-w-prose text-dense text-muted-foreground">
            Deleting your account is permanent. Your profile and CVs will be removed, and you will
            no longer be able to sign in. Employers can still read the information sent with
            Applications you already submitted.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setConfirmingDeletion(true)}>
          Delete my account
        </Button>
      </section>

      <DeleteAccountDialog open={confirmingDeletion} onOpenChange={setConfirmingDeletion} />
    </div>
  );
}
