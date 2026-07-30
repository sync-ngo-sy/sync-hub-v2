import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import { Input } from '@sync/ui/components/ui/input';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useSignUp } from '../features/auth/hooks/use-signup';
import { signUpSchema } from '../features/auth/schemas/signup-schema';
import { bounceIfAuthed } from '../lib/auth';
import { errorStatus } from '../lib/errors';

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    await bounceIfAuthed(context.queryClient);
  },
  component: SignUpPage,
});

function SignUpPage() {
  const { signUp, mutation } = useSignUp();
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: '', email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await signUp(values);
    } catch (error) {
      // The server's own rejections render against the field they concern, not as a toast.
      if (errorStatus(error) === 409) {
        form.setError('email', { message: 'An account already exists for this email address.' });
      } else if (errorStatus(error) === 400) {
        form.setError('password', {
          message: 'That password was rejected. Choose a stronger one.',
        });
      } else {
        form.setError('root', { message: 'Something went wrong. Try again.' });
      }
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit} noValidate>
            <FormField control={form.control} name="full_name" label="Full name">
              {(field) => <Input {...field} autoComplete="name" />}
            </FormField>
            <FormField control={form.control} name="email" label="Email">
              {(field) => <Input {...field} type="email" autoComplete="email" />}
            </FormField>
            <FormField control={form.control} name="password" label="Password">
              {(field) => <Input {...field} type="password" autoComplete="new-password" />}
            </FormField>
            {form.formState.errors.root ? (
              <p role="alert" className="text-sm text-destructive-foreground">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <Button type="submit" disabled={mutation.isPending}>
              Create account
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" search={{ returnTo: undefined }} className="underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
