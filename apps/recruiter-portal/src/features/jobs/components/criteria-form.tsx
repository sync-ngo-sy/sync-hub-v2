import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import { useReplaceJobCriteria } from '../hooks/use-job-actions';
import type { Job } from '../job';
import {
  type CriteriaFormValues,
  criteriaFormSchema,
  toCriteria,
  toCriteriaFormValues,
} from '../schemas/criteria';
import { CriteriaFields } from './criteria-fields';

export function CriteriaForm({ job }: { job: Job }) {
  const replace = useReplaceJobCriteria(job.id);
  const form = useForm<CriteriaFormValues>({
    resolver: zodResolver(criteriaFormSchema),
    defaultValues: toCriteriaFormValues(job.criteria),
  });

  const save = form.handleSubmit(async (values) => {
    try {
      const criteria = await replace.mutateAsync({
        params: { path: { job_id: job.id } },
        body: toCriteria(values),
      });
      form.reset(toCriteriaFormValues(criteria));
      toast.success('Screening criteria replaced');
    } catch (error) {
      form.setError('root', {
        message: problemMessage(error, "This Job's screening criteria couldn't be replaced."),
      });
    }
  });

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      {job.criteria_locked ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Screening criteria are locked</AlertTitle>
          <AlertDescription>
            This Job already has an Application, so every applicant keeps the same screening bar.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>This is a whole-set replacement</AlertTitle>
          <AlertDescription>
            Saving replaces the whole set of screening criteria. Anything you remove or leave out
            will be deleted, not merged with the current set.
          </AlertDescription>
        </Alert>
      )}

      <CriteriaFields form={form} disabled={job.criteria_locked} />

      {form.formState.errors.root?.message ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Screening criteria not replaced</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      {job.criteria_locked ? null : (
        <div className="flex justify-end">
          <Button type="submit" disabled={replace.isPending}>
            {replace.isPending ? 'Saving…' : 'Save screening criteria'}
          </Button>
        </div>
      )}
    </form>
  );
}
