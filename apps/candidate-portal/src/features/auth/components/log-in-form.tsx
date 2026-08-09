import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { PasswordInput } from '@sync/ui/components/password-input';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isClientError, problemMessage } from '@/lib/api-problem';
import type { Profile } from '../current-profile';
import { useLogIn } from '../hooks/use-log-in';
import { type LogInValues, logInSchema } from '../schemas/log-in';

export function LogInForm({ onSignedIn }: { onSignedIn: (profile: Profile) => void }) {
  const logIn = useLogIn();
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<LogInValues>({
    resolver: zodResolver(logInSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      onSignedIn(await logIn.mutateAsync({ body: values }));
    } catch (error) {
      const message = problemMessage(error, "Couldn't sign you in. Try again.");
      if (isClientError(error)) {
        setError('password', { message });
        return;
      }
      toast.error(message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField control={control} name="email" label="Email">
        {(field) => <Input {...field} type="email" autoComplete="email" />}
      </FormField>

      <FormField control={control} name="password" label="Password">
        {(field) => <PasswordInput {...field} autoComplete="current-password" />}
      </FormField>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
