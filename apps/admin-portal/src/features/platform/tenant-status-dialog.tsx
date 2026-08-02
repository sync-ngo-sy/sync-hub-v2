import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sync/ui/components/ui/alert-dialog';
import { problemMessage } from '@/lib/api-problem';
import type { PlatformTenant } from './tenant';
import { useSetPlatformTenantStatus } from './tenant-queries';

interface TenantStatusDialogProps {
  tenant: PlatformTenant | null;
  onClose: () => void;
}

export function TenantStatusDialog({ tenant, onClose }: TenantStatusDialogProps) {
  const setStatus = useSetPlatformTenantStatus();

  function changeOpen(open: boolean) {
    if (open || setStatus.isPending) return;
    setStatus.reset();
    onClose();
  }

  if (!tenant) return null;

  const selectedTenant = tenant;
  const suspend = selectedTenant.is_active;
  const verb = suspend ? 'Suspend' : 'Restore';
  const consequence = suspend
    ? `Every recruiter at ${selectedTenant.name} will lose access immediately, and its jobs will leave the public job board. No tenant data will be deleted.`
    : `Every active recruiter at ${selectedTenant.name} will regain their previous access. Published jobs that are still current will return to the public job board.`;

  async function confirm() {
    try {
      await setStatus.mutateAsync({
        params: { path: { tenant_id: selectedTenant.id } },
        body: { is_active: !suspend },
      });
      onClose();
    } catch {
      return;
    }
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`${verb} ${selectedTenant.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>

        {setStatus.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{`Tenant not ${suspend ? 'suspended' : 'restored'}`}</AlertTitle>
            <AlertDescription>
              {problemMessage(
                setStatus.error,
                `${selectedTenant.name} couldn't be ${suspend ? 'suspended' : 'restored'}. Try again.`,
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={setStatus.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={suspend ? 'destructive' : 'default'}
            disabled={setStatus.isPending}
            onClick={confirm}
          >
            {setStatus.isPending ? `${verb}ing tenant…` : `${verb} tenant`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
