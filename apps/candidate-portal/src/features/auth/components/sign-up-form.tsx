import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { PasswordInput } from '@sync/ui/components/password-input';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { isProblem, problemMessage } from '@/lib/api-problem';
import { useSignUp } from '../hooks/use-sign-up';
import { EMAIL_TAKEN_PROBLEM, WEAK_PASSWORD_PROBLEM } from '../problems';
import { type SignUpValues, signUpSchema } from '../schemas/sign-up';
import { PasswordChecklist } from './password-checklist';

export function SignUpForm({ onSignedUp }: { onSignedUp: (email: string) => void }) {
  const signUp = useSignUp();
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: '', email: '', password: '', confirm_password: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const submit = handleSubmit(async ({ full_name, email, password: chosen }) => {
    try {
      await signUp.mutateAsync({ body: { full_name, email, password: chosen } });
      onSignedUp(email);
    } catch (error) {
      const message = problemMessage(error, "Couldn't create your account. Try again.");
      if (isProblem(error, EMAIL_TAKEN_PROBLEM)) {
        setError('email', { message });
        return;
      }
      if (isProblem(error, WEAK_PASSWORD_PROBLEM)) {
        setError('password', { message });
        return;
      }
      toast.error(message);
    }
  });

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-5">
        <FormField control={control} name="full_name" label="Full name">
          {(field) => <Input {...field} autoComplete="name" />}
        </FormField>

        <FormField control={control} name="email" label="Email">
          {(field) => <Input {...field} type="email" autoComplete="email" />}
        </FormField>

        <FormField control={control} name="password" label="Password">
          {(field) => <PasswordInput {...field} autoComplete="new-password" />}
        </FormField>

        <FormField control={control} name="confirm_password" label="Confirm password">
          {(field) => <PasswordInput {...field} autoComplete="new-password" />}
        </FormField>

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>

      <aside className="sm:sticky sm:top-24 sm:pt-8">
        <PasswordChecklist password={password} />
      </aside>
    </div>
  );
}
