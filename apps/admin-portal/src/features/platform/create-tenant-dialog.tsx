import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { useForm } from 'react-hook-form';
import { problemMessage } from '@/lib/api-problem';
import { type CreateTenantFormValues, createTenantSchema } from './tenant-form-schema';
import { useCreatePlatformTenant } from './tenant-queries';

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyTenant: CreateTenantFormValues = { name: '', slug: '', full_name: '', email: '' };

export function CreateTenantDialog({ open, onOpenChange }: CreateTenantDialogProps) {
  const createTenant = useCreatePlatformTenant();
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: emptyTenant,
  });

  function changeOpen(nextOpen: boolean) {
    if (isSubmitting) return;
    createTenant.reset();
    if (!nextOpen) reset(emptyTenant);
    onOpenChange(nextOpen);
  }

  const submit = handleSubmit(async (body) => {
    try {
      await createTenant.mutateAsync({ body });
      reset(emptyTenant);
      onOpenChange(false);
    } catch {
      return;
    }
  });

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create tenant</DialogTitle>
          <DialogDescription>
            Open a tenant and email an invitation to its founding admin.
          </DialogDescription>
        </DialogHeader>

        <form id="create-tenant-form" onSubmit={submit} noValidate className="space-y-4">
          <FormField control={control} name="name" label="Tenant name">
            {(field) => <Input {...field} autoComplete="organization" />}
          </FormField>
          <FormField
            control={control}
            name="slug"
            label="Tenant address"
            description="Lowercase letters, numbers and single hyphens."
          >
            {(field) => <Input {...field} autoComplete="off" />}
          </FormField>
          <FormField control={control} name="full_name" label="Founding admin name">
            {(field) => <Input {...field} autoComplete="name" />}
          </FormField>
          <FormField control={control} name="email" label="Founding admin email">
            {(field) => <Input {...field} type="email" autoComplete="email" />}
          </FormField>
        </form>

        {createTenant.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Tenant not created</AlertTitle>
            <AlertDescription>
              {problemMessage(createTenant.error, "This tenant couldn't be created. Try again.")}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => changeOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-tenant-form" disabled={isSubmitting}>
            {isSubmitting ? 'Creating tenant…' : 'Create tenant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
