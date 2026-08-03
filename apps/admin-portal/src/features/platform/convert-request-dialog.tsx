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
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { problemMessage } from '@/lib/api-problem';
import { type AccessRequest, suggestedSlug } from './access-request';
import { useConvertAccessRequest } from './access-request-queries';
import { type TenantSlugFormValues, tenantSlugSchema } from './tenant-form-schema';

interface ConvertRequestDialogProps {
  request: AccessRequest | null;
  onClose: () => void;
}

export function ConvertRequestDialog({ request, onClose }: ConvertRequestDialogProps) {
  const convert = useConvertAccessRequest();
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<TenantSlugFormValues>({
    resolver: zodResolver(tenantSlugSchema),
    defaultValues: { slug: '' },
  });

  useEffect(() => {
    if (request) reset({ slug: suggestedSlug(request.company) });
  }, [request, reset]);

  function changeOpen(open: boolean) {
    if (open || isSubmitting) return;
    convert.reset();
    onClose();
  }

  if (!request) return null;

  const selectedRequest = request;
  const submit = handleSubmit(async ({ slug }) => {
    try {
      await convert.mutateAsync({
        params: { path: { request_id: selectedRequest.id } },
        body: { slug },
      });
      onClose();
    } catch {
      return;
    }
  });

  return (
    <Dialog open onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Convert the request from ${selectedRequest.company}`}</DialogTitle>
          <DialogDescription>
            {`${selectedRequest.full_name} (${selectedRequest.email}) becomes the founding admin and is emailed an invitation. Only the tenant's address is yours to choose.`}
          </DialogDescription>
        </DialogHeader>

        <form id="convert-request-form" onSubmit={submit} noValidate>
          <FormField
            control={control}
            name="slug"
            label="Tenant address"
            description="Lowercase letters, numbers and single hyphens."
          >
            {(field) => <Input {...field} autoComplete="off" />}
          </FormField>
        </form>

        {convert.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Request not converted</AlertTitle>
            <AlertDescription>
              {problemMessage(
                convert.error,
                "This request couldn't be converted. The request is still waiting.",
              )}
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
          <Button type="submit" form="convert-request-form" disabled={isSubmitting}>
            {isSubmitting ? 'Converting…' : 'Convert to tenant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
