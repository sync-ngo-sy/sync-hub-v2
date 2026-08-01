import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isClientError, problemMessage, problemStatus } from '@/lib/api-problem';
import { useSignUp } from '../hooks/use-sign-up';
import { type SignUpValues, signUpSchema } from '../schemas/sign-up';

export function SignUpForm({ onSignedUp }: { onSignedUp: (email: string) => void }) {
  const signUp = useSignUp();
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await signUp.mutateAsync({ body: values });
      onSignedUp(values.email);
    } catch (error) {
      const message = problemMessage(error, "Couldn't create your account. Try again.");
      // The only two rejections this route has: 400 is the identity provider refusing the
      // password, and 409 is the address already having an account (§7.2).
      if (isClientError(error)) {
        setError(problemStatus(error) === 400 ? 'password' : 'email', { message });
        return;
      }
      toast.error(message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField control={control} name="full_name" label="Full name">
        {(field) => <Input {...field} autoComplete="name" />}
      </FormField>

      <FormField control={control} name="email" label="Email">
        {(field) => <Input {...field} type="email" autoComplete="email" />}
      </FormField>

      <FormField
        control={control}
        name="password"
        label="Password"
        description="At least 8 characters."
      >
        {(field) => <Input {...field} type="password" autoComplete="new-password" />}
      </FormField>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Creating your account…' : 'Create account'}
      </Button>
    </form>
  );
}
