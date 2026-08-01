import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { type FormEvent, useState } from 'react';
import { problemMessage } from '@/lib/api-problem';
import { useDeleteAccount } from '../hooks/use-delete-account';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [password, setPassword] = useState('');
  const deleteAccount = useDeleteAccount();

  function changeOpen(nextOpen: boolean) {
    if (deleteAccount.isPending) return;
    if (!nextOpen) {
      setPassword('');
      deleteAccount.reset();
    }
    onOpenChange(nextOpen);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || deleteAccount.isPending) return;
    deleteAccount.mutate({ body: { password } });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={!deleteAccount.isPending}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Delete your account permanently?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Your profile and CVs will be removed. Employers can still read
              the information sent with Applications you already submitted.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="delete-account-password">Current password</Label>
            <Input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={deleteAccount.isPending}
              aria-invalid={deleteAccount.isError || undefined}
              aria-describedby={
                deleteAccount.isError
                  ? 'delete-account-password-description delete-account-password-error'
                  : 'delete-account-password-description'
              }
              onChange={(event) => {
                setPassword(event.target.value);
                if (deleteAccount.isError) deleteAccount.reset();
              }}
            />
            <p
              id="delete-account-password-description"
              className="text-dense text-muted-foreground"
            >
              Enter your current password to confirm this is really you.
            </p>
            {deleteAccount.isError ? (
              <p
                id="delete-account-password-error"
                role="alert"
                className="text-dense text-destructive"
              >
                {problemMessage(
                  deleteAccount.error,
                  "Your account couldn't be deleted. Try again.",
                )}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={deleteAccount.isPending}
            >
              Keep my account
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={!password || deleteAccount.isPending}
            >
              {deleteAccount.isPending ? 'Deleting account…' : 'Delete account permanently'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
