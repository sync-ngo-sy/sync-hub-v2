import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@sync/ui/components/password-input';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { problemMessage } from '@/lib/api-problem';
import type { Profile } from '../current-profile';
import { useLogIn } from '../hooks/use-log-in';
import { type LogInValues, logInSchema } from '../schemas/log-in';

export function LogInForm({ onSignedIn }: { onSignedIn: (profile: Profile) => void }) {
  const emailId = useId();
  const passwordId = useId();
  const logIn = useLogIn();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LogInValues>({
    resolver: zodResolver(logInSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      onSignedIn(await logIn.mutateAsync({ body: values }));
    } catch (error) {
      setError('password', {
        message: problemMessage(error, "Couldn't sign you in. Try again."),
      });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          {...register('email')}
        />
        {errors.email ? (
          <p role="alert" className="text-dense text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={passwordId}>Password</Label>
        <PasswordInput
          id={passwordId}
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          {...register('password')}
        />
        {errors.password ? (
          <p role="alert" className="text-dense text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
