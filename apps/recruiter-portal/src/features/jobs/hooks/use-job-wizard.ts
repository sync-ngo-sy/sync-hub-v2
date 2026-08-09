import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { problemMessage } from '@/lib/api-problem';
import type { Job } from '../job';
import { jobFormRejection } from '../rejection';
import { type CriteriaFormValues, criteriaFormSchema, toCriteria } from '../schemas/criteria';
import { type JobFormValues, jobFormSchema, toNewJob } from '../schemas/job';
import { clearWizardDraft, readWizardDraft, type WizardStep, writeWizardDraft } from '../wizard';
import { useChangeJob, useCreateJob, useReplaceCriteria } from './use-job-actions';

export type CreateOutcome =
  | { kind: 'created'; job: Job }
  | { kind: 'unfinished'; job: Job; message: string }
  | { kind: 'refused'; step: WizardStep; message: string | null };

function screens(criteria: ReturnType<typeof toCriteria>): boolean {
  return (
    criteria.minimum_total_experience_years !== null ||
    (criteria.skills?.length ?? 0) > 0 ||
    (criteria.languages?.length ?? 0) > 0 ||
    (criteria.questions?.length ?? 0) > 0
  );
}

export function useJobWizard() {
  const draft = readWizardDraft();
  const details = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: draft.details,
  });
  const screening = useForm<CriteriaFormValues>({
    resolver: zodResolver(criteriaFormSchema),
    defaultValues: draft.screening,
  });

  useEffect(() => {
    const save = () =>
      writeWizardDraft({ details: details.getValues(), screening: screening.getValues() });
    const watchedDetails = details.watch(save);
    const watchedScreening = screening.watch(save);
    return () => {
      watchedDetails.unsubscribe();
      watchedScreening.unsubscribe();
    };
  }, [details, screening]);

  const create = useCreateJob();
  const replaceCriteria = useReplaceCriteria();
  const change = useChangeJob();

  async function validate(step: WizardStep): Promise<boolean> {
    if (step === 'details') return details.trigger();
    if (step === 'screening') return screening.trigger();
    return true;
  }

  async function submit(status: 'draft' | 'published'): Promise<CreateOutcome> {
    if (!(await details.trigger())) return { kind: 'refused', step: 'details', message: null };
    if (!(await screening.trigger())) return { kind: 'refused', step: 'screening', message: null };

    let job: Job;
    try {
      job = await create.mutateAsync({ body: toNewJob(details.getValues()) });
    } catch (error) {
      const rejection = jobFormRejection(error);
      for (const field of rejection.fields)
        details.setError(field.name, { message: field.message });
      return {
        kind: 'refused',
        step: rejection.fields.length > 0 ? 'details' : 'review',
        message: rejection.root,
      };
    }

    const criteria = toCriteria(screening.getValues());
    if (screens(criteria)) {
      try {
        await replaceCriteria.mutateAsync({
          params: { path: { job_id: job.id } },
          body: criteria,
        });
      } catch (error) {
        clearWizardDraft();
        return {
          kind: 'unfinished',
          job,
          message: problemMessage(
            error,
            'The Job was created as a draft, but its screening criteria were not saved.',
          ),
        };
      }
    }

    if (status === 'published') {
      try {
        job = await change.mutateAsync({
          params: { path: { job_id: job.id } },
          body: { status: 'published' },
        });
      } catch (error) {
        clearWizardDraft();
        return {
          kind: 'unfinished',
          job,
          message: problemMessage(
            error,
            'The Job was created as a draft, but it could not be published.',
          ),
        };
      }
    }

    clearWizardDraft();
    return { kind: 'created', job };
  }

  return {
    details,
    screening,
    validate,
    submit,
    isSubmitting: create.isPending || replaceCriteria.isPending || change.isPending,
  };
}
