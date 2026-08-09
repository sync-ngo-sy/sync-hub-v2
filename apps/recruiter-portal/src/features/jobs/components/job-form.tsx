import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useChangeJob } from '../hooks/use-job-actions';
import type { Job, JobChanges } from '../job';
import { jobFormRejection } from '../rejection';
import { type JobFormValues, jobFormSchema, toNewJob } from '../schemas/job';
import { JobFields } from './job-fields';

function inputDateTime(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function editValues(job: Job): JobFormValues {
  return {
    title: job.title,
    description: job.description,
    locationKey: job.location_key ?? '',
    employmentType: job.employment_type ?? '',
    workMode: job.work_mode ?? '',
    expiresAt: job.expires_at ? inputDateTime(job.expires_at) : '',
  };
}

interface JobFormProps {
  job: Job;
  onSaved: () => void;
  onCancel: () => void;
}

export function JobForm({ job, onSaved, onCancel }: JobFormProps) {
  const change = useChangeJob();
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: editValues(job),
  });

  const save = form.handleSubmit(async (values) => {
    try {
      await change.mutateAsync({
        params: { path: { job_id: job.id } },
        body: toNewJob(values) satisfies JobChanges,
      });
      toast.success('Job updated');
      onSaved();
    } catch (error) {
      const rejection = jobFormRejection(error);
      for (const field of rejection.fields) form.setError(field.name, { message: field.message });
      if (rejection.root) form.setError('root', { message: rejection.root });
    }
  });

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <JobFields control={form.control} autoFocus />

      {form.formState.errors.root?.message ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Job not saved</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={change.isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
