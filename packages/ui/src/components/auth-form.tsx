import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import type { FormEventHandler } from 'react';
import type { Control } from 'react-hook-form';

export interface EmailFormValues {
  email: string;
}

export function EmailForm({
  control,
  onSubmit,
  isSubmitting,
}: {
  control: Control<EmailFormValues>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  isSubmitting: boolean;
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormField control={control} name="email" label="Email">
        {(field) => <Input {...field} type="email" autoComplete="email" />}
      </FormField>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}

export interface PasswordFormValues {
  password: string;
}

export function PasswordForm({
  control,
  onSubmit,
  isSubmitting,
  label,
  pendingLabel,
  submitLabel,
}: {
  control: Control<PasswordFormValues>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  isSubmitting: boolean;
  label: string;
  pendingLabel: string;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormField
        control={control}
        name="password"
        label={label}
        description="At least 8 characters."
      >
        {(field) => <Input {...field} type="password" autoComplete="new-password" />}
      </FormField>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
