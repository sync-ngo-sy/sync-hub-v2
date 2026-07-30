import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import { Input } from '@sync/ui/components/ui/input';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useRequestPasswordReset } from '../features/auth/hooks/use-request-password-reset';
import { requestPasswordResetSchema } from '../features/auth/schemas/password-reset-schema';
import { bounceIfAuthed } from '../lib/auth';

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: async ({ context }) => {
    await bounceIfAuthed(context.queryClient);
  },
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { requestReset, mutation } = useRequestPasswordReset();
  const form = useForm({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestReset(values);
    } catch {
      form.setError('root', { message: 'Something went wrong. Try again.' });
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          {mutation.isSuccess ? (
            // Neutral by design: never reveal whether the address has an account.
            <p className="text-sm text-muted-foreground">
              If that email address has an account, we've sent a link to reset its password. Check
              your inbox.
            </p>
          ) : (
            <form className="grid gap-4" onSubmit={onSubmit} noValidate>
              <FormField control={form.control} name="email" label="Email">
                {(field) => <Input {...field} type="email" autoComplete="email" />}
              </FormField>
              {form.formState.errors.root ? (
                <p role="alert" className="text-sm text-destructive-foreground">
                  {form.formState.errors.root.message}
                </p>
              ) : null}
              <Button type="submit" disabled={mutation.isPending}>
                Send reset link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/login" search={{ returnTo: undefined }} className="underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
