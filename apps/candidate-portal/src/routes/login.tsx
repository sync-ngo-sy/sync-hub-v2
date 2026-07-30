import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import { Input } from '@sync/ui/components/ui/input';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useLogin } from '../features/auth/hooks/use-login';
import { loginSchema } from '../features/auth/schemas/login-schema';
import { bounceIfAuthed, isSafeReturnTo } from '../lib/auth';
import { errorStatus } from '../lib/errors';

const loginSearchSchema = z.object({
  // Drop any returnTo that isn't an in-app path, so it can never become an external redirect.
  returnTo: z
    .string()
    .optional()
    .transform((value) => (value && isSafeReturnTo(value) ? value : undefined)),
});

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => loginSearchSchema.parse(search),
  beforeLoad: async ({ context }) => {
    await bounceIfAuthed(context.queryClient);
  },
  component: LoginPage,
});

function errorMessage(error: unknown): string {
  return errorStatus(error) === 403
    ? 'Confirm your email address before logging in.'
    : 'Incorrect email or password.';
}

function LoginPage() {
  const { returnTo } = Route.useSearch();
  const { login, mutation } = useLogin();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values, returnTo);
    } catch (error) {
      form.setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Log in</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit} noValidate>
            <FormField control={form.control} name="email" label="Email">
              {(field) => <Input {...field} type="email" autoComplete="email" />}
            </FormField>
            <FormField control={form.control} name="password" label="Password">
              {(field) => <Input {...field} type="password" autoComplete="current-password" />}
            </FormField>
            {form.formState.errors.root ? (
              <p role="alert" className="text-sm text-destructive-foreground">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <Button type="submit" disabled={mutation.isPending}>
              Log in
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline underline-offset-4">
          Back to Sync
        </Link>
      </p>
    </div>
  );
}
