import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useLocations } from '@/features/reference/hooks/use-locations';
import { locationGroups } from '@/features/reference/options';
import { useChangeJob, useCreateJob } from '../hooks/use-job-actions';
import {
  EMPLOYMENT_TYPE_LABELS,
  type Job,
  type JobChanges,
  type NewJob,
  WORK_MODE_LABELS,
} from '../job';
import { jobFormRejection } from '../rejection';
import { type JobFormValues, jobFormSchema } from '../schemas/job';
import { ChoiceSelect } from './choice-select';

/** The blank leads, and is what a Job nobody has decided about yet shows — a select has no
 * empty state of its own, and the first value would otherwise read as a choice. */
const EMPLOYMENT_TYPES = { '': 'Not set', ...EMPLOYMENT_TYPE_LABELS };
const WORK_MODES = { '': 'Not set', ...WORK_MODE_LABELS };

const EMPTY_JOB: JobFormValues = {
  title: '',
  description: '',
  locationKey: '',
  employmentType: '',
  workMode: '',
  expiresAt: '',
};

function optional(value: string): string | null {
  return value.trim() || null;
}

function newJob(values: JobFormValues): NewJob {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    location_key: optional(values.locationKey),
    employment_type: values.employmentType || null,
    work_mode: values.workMode || null,
    expires_at: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
  };
}

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
  job?: Job;
  onSaved: () => void;
  onCancel: () => void;
}

export function JobForm({ job, onSaved, onCancel }: JobFormProps) {
  const places = useLocations();
  const create = useCreateJob();
  const change = useChangeJob();
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: job ? editValues(job) : EMPTY_JOB,
  });

  const save = form.handleSubmit(async (values) => {
    try {
      if (job) {
        await change.mutateAsync({
          params: { path: { job_id: job.id } },
          body: newJob(values) satisfies JobChanges,
        });
        toast.success('Job updated');
      } else {
        await create.mutateAsync({ body: newJob(values) });
        toast.success('Draft saved');
      }
      onSaved();
    } catch (error) {
      const rejection = jobFormRejection(error);
      for (const field of rejection.fields) form.setError(field.name, { message: field.message });
      if (rejection.root) form.setError('root', { message: rejection.root });
    }
  });
  const isPending = create.isPending || change.isPending;

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <FormField control={form.control} name="title" label="Title">
        {(field) => <Input {...field} value={field.value} autoFocus />}
      </FormField>

      <FormField control={form.control} name="description" label="Description">
        {(field) => <Textarea {...field} value={field.value} rows={6} />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={form.control} name="locationKey" label="Location">
          {({ value, onChange, onBlur, id, ...aria }) => (
            <ReferencePicker
              id={id}
              noun="location"
              list={places}
              options={locationGroups(places.data)}
              value={value || null}
              onChange={onChange}
              onBlur={onBlur}
              aria-describedby={aria['aria-describedby']}
              aria-invalid={aria['aria-invalid']}
            />
          )}
        </FormField>
        <FormField
          control={form.control}
          name="workMode"
          label="Work mode"
          description="Where the work happens. A remote role still has a Location."
        >
          {(field) => <ChoiceSelect field={field} items={WORK_MODES} />}
        </FormField>
        <FormField control={form.control} name="employmentType" label="Employment type">
          {(field) => <ChoiceSelect field={field} items={EMPLOYMENT_TYPES} />}
        </FormField>
      </div>

      <FormField
        control={form.control}
        name="expiresAt"
        label="Closing date"
        description="Optional. Leave blank to keep the Job open until you close it."
      >
        {(field) => <Input {...field} value={field.value} type="datetime-local" />}
      </FormField>

      {form.formState.errors.root?.message ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Job not saved</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : job ? 'Save changes' : 'Save draft'}
        </Button>
      </div>
    </form>
  );
}
