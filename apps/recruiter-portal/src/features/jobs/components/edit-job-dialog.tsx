import { SkeletonText } from '@sync/ui/components/skeletons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { useJob } from '../hooks/use-job';
import { JobForm } from './job-form';

interface EditJobDialogProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditJobDialog({ jobId, open, onOpenChange }: EditJobDialogProps) {
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

        {job.data ? (
          <JobForm
            job={job.data}
            onSaved={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
