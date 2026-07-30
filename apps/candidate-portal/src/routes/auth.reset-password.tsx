import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import { Input } from '@sync/ui/components/ui/input';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useResetPassword } from '../features/auth/hooks/use-reset-password';
import { resetPasswordSchema } from '../features/auth/schemas/password-reset-schema';
import { errorStatus } from '../lib/errors';

const resetPasswordSearchSchema = z.object({
  token_hash: z.string().optional(),
  // GoTrue appends `&type=recovery`; accept it so it doesn't fail validation, but we don't use it.
  type: z.string().optional(),
});

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: (search: Record<string, unknown>) => resetPasswordSearchSchema.parse(search),
  component: ResetPasswordPage,
});

function RecoveryPath() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-h2 font-heading text-foreground">This link didn't work</h1>
      <p className="text-muted-foreground">
        Your reset link is invalid or has expired. Request a new one and we'll email you a fresh
        link.
      </p>
      <Button render={<Link to="/forgot-password">Request a new link</Link>} />
    </div>
  );
}

function ResetPasswordPage() {
  const { token_hash } = Route.useSearch();
  const { resetPassword } = useResetPassword();
  const [linkRejected, setLinkRejected] = useState(false);
  const form = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '', password: '' },
  });

  // No token, or a token the server refused: send the user back down the recovery path rather
  // than presenting a form that can only fail.
  if (!token_hash || linkRejected) return <RecoveryPath />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await resetPassword(values, token_hash);
    } catch (error) {
      if (errorStatus(error) === 400) {
        setLinkRejected(true);
      } else {
        form.setError('root', { message: 'Something went wrong. Try again.' });
      }
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit} noValidate>
            <FormField control={form.control} name="email" label="Email">
              {(field) => <Input {...field} type="email" autoComplete="email" />}
            </FormField>
            <FormField control={form.control} name="password" label="New password">
              {(field) => <Input {...field} type="password" autoComplete="new-password" />}
            </FormField>
            {form.formState.errors.root ? (
              <p role="alert" className="text-sm text-destructive-foreground">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Set new password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
