import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { errorStatus } from '../../../lib/errors';
import { useDeleteAccount } from '../hooks/use-delete-account';
import { deleteAccountSchema } from '../schemas/delete-account-schema';

function errorMessage(error: unknown): string {
  return errorStatus(error) === 401
    ? 'Incorrect password.'
    : 'Something went wrong. Please try again.';
}

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const { deleteAccount, mutation } = useDeleteAccount();
  const form = useForm({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  });

  // Reset the form and any stale error each time the dialog opens or closes, so a reopened dialog
  // never shows the password or error from a previous attempt.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset();
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await deleteAccount(values.password);
    } catch (error) {
      form.setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="destructive">Delete account</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>This is permanent and cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Deleting your account will:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Erase your profile, your CVs, and your contact details</li>
            <li>Remove you from employer searches for good</li>
            <li>Sign you out and block this login from being used again</li>
          </ul>
          <p>
            Applications you've already sent stay with the employers who received them — including
            the CV attached to each — so their hiring records remain intact.
          </p>
        </div>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <FormField
            control={form.control}
            name="password"
            label="Confirm your password to continue"
          >
            {(field) => <Input {...field} type="password" autoComplete="current-password" />}
          </FormField>
          {form.formState.errors.root ? (
            <p role="alert" className="text-sm text-destructive-foreground">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" disabled={mutation.isPending}>
              Delete my account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
