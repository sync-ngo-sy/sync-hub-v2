import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { problemDetail, problemStatus } from '@/lib/problem';
import type { Profile } from '../current-profile';
import { useLogIn } from '../hooks/use-log-in';
import { type LogInValues, logInSchema } from '../schemas/log-in';

function signInMessage(error: unknown): string {
  switch (problemStatus(error)) {
    case 401:
      return 'That email and password do not match an account.';
    case 403:
      return 'Confirm your email address before signing in — check your inbox for the link.';
    case 422:
      return 'Check the email address and password, then try again.';
    default:
      return problemDetail(error) ?? 'Something went wrong signing you in. Please try again.';
  }
}

export function LogInForm({ onSignedIn }: { onSignedIn: (profile: Profile) => void }) {
  const logIn = useLogIn();
  const form = useForm<LogInValues>({
    resolver: zodResolver(logInSchema),
    defaultValues: { email: '', password: '' },
  });
  const rootError = form.formState.errors.root?.message;

  const submit = form.handleSubmit(async (values) => {
    try {
      onSignedIn(await logIn.mutateAsync({ body: values }));
    } catch (error) {
      form.setError('root', { message: signInMessage(error) });
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {rootError ? (
        <p
          role="alert"
          className="rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground"
        >
          {rootError}
        </p>
      ) : null}

      <FormField control={form.control} name="email" label="Email address">
        {(field) => <Input {...field} type="email" autoComplete="email" autoFocus />}
      </FormField>

      <FormField control={form.control} name="password" label="Password">
        {(field) => <Input {...field} type="password" autoComplete="current-password" />}
      </FormField>

      <Button type="submit" size="lg" className="mt-1" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
        Sign in
      </Button>
    </form>
  );
}
