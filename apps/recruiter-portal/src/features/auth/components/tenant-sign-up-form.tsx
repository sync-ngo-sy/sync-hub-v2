import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isProblem, problemMessage } from '@/lib/api-problem';
import { useTenantSignUp } from '../hooks/use-tenant-sign-up';
import { EMAIL_TAKEN_PROBLEM, SLUG_TAKEN_PROBLEM, WEAK_PASSWORD_PROBLEM } from '../problems';
import { type TenantSignUpValues, tenantSignUpSchema } from '../schemas/tenant-sign-up';

export function TenantSignUpForm({ onSignedUp }: { onSignedUp: (email: string) => void }) {
  const signUp = useTenantSignUp();
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<TenantSignUpValues>({
    resolver: zodResolver(tenantSignUpSchema),
    defaultValues: { tenant_name: '', slug: '', full_name: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await signUp.mutateAsync({ body: values });
      onSignedUp(values.email);
    } catch (error) {
      const message = problemMessage(error, "Couldn't create your workspace. Try again.");
      if (isProblem(error, SLUG_TAKEN_PROBLEM)) {
        setError('slug', { message });
        return;
      }
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
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField control={control} name="tenant_name" label="Workspace name">
        {(field) => <Input {...field} autoComplete="organization" />}
      </FormField>

      <FormField
        control={control}
        name="slug"
        label="Workspace address"
        description="Lowercase letters, numbers and single hyphens."
      >
        {(field) => <Input {...field} autoComplete="off" />}
      </FormField>

      <FormField control={control} name="full_name" label="Your name">
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
        {isSubmitting ? 'Creating your workspace…' : 'Create workspace'}
      </Button>
    </form>
  );
}
