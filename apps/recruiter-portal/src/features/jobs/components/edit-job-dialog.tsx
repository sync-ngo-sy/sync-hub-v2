import { SkeletonText } from '@sync/ui/components/skeletons';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { CircleAlert } from 'lucide-react';
import { problemMessage } from '@/lib/api-problem';
import { useJob } from '../hooks/use-job';
import type { JobStatus } from '../job';
import { JobForm } from './job-form';

interface EditJobDialogProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status?: JobStatus;
}

export function EditJobDialog({ jobId, open, onOpenChange, status }: EditJobDialogProps) {
  const job = useJob(jobId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>
            Update the role's public details. Its lifecycle is managed from the Jobs list.
          </DialogDescription>
        </DialogHeader>

        {job.isPending ? (
          <div role="status" aria-label="Loading Job" className="py-4">
            <SkeletonText lines={5} />
          </div>
        ) : null}

        {job.isError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Job not loaded</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{problemMessage(job.error, "This Job couldn't be loaded.")}</p>
              <Button variant="outline" size="sm" onClick={() => void job.refetch()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {job.data ? (
          <JobForm
            status={status}
            job={job.data}
            onSaved={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
