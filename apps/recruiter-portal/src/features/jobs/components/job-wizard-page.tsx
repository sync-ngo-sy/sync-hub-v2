import { PageHeader } from '@sync/ui/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { cn } from '@sync/ui/lib/utils';
import { ArrowLeft, ArrowRight, Check, CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useJobWizard } from '../hooks/use-job-wizard';
import type { Job } from '../job';
import {
  clearWizardDraft,
  reachableStep,
  WIZARD_STEP_LABELS,
  WIZARD_STEPS,
  type WizardStep,
} from '../wizard';
import { CriteriaFields } from './criteria-fields';
import { JobFields } from './job-fields';
import { JobWizardReview } from './job-wizard-review';

const STEP_DESCRIPTIONS: Record<WizardStep, string> = {
  details: 'How the role reads to a Candidate. Nothing is saved until the last step.',
  screening: 'The bar every applicant is measured against, and the questions they answer.',
  review: 'Read it back, then publish the Job or keep it as a draft.',
};

interface JobWizardPageProps {
  step: WizardStep;
  onStepChange: (step: WizardStep) => void;
  onCreated: (job: Job) => void;
  onCancel: () => void;
}

export function JobWizardPage({
  step: wanted,
  onStepChange,
  onCreated,
  onCancel,
}: JobWizardPageProps) {
  const wizard = useJobWizard();
  const [failure, setFailure] = useState<string | null>(null);
  const step = reachableStep(
    { details: wizard.details.getValues(), screening: wizard.screening.getValues() },
    wanted,
  );
  const index = WIZARD_STEPS.indexOf(step);
  const previous = WIZARD_STEPS[index - 1];
  const next = WIZARD_STEPS[index + 1];

  async function goTo(next: WizardStep) {
    setFailure(null);
    const target = WIZARD_STEPS.indexOf(next);
    if (target > index) {
      for (const passed of WIZARD_STEPS.slice(index, target)) {
        if (!(await wizard.validate(passed))) {
          onStepChange(passed);
          return;
        }
      }
    }
    onStepChange(next);
  }

  async function submit(status: 'draft' | 'published') {
    setFailure(null);
    const outcome = await wizard.submit(status);

    if (outcome.kind === 'refused') {
      setFailure(outcome.message);
      onStepChange(outcome.step);
      return;
    }

    if (outcome.kind === 'unfinished') {
      toast.error(outcome.message);
      onCreated(outcome.job);
      return;
    }

    toast.success(status === 'published' ? 'Job published' : 'Draft saved');
    onCreated(outcome.job);
  }

  function abandon() {
    clearWizardDraft();
    onCancel();
  }

  return (
    <div className="space-y-(--space-section)">
      <PageHeader title="Create a Job" description={STEP_DESCRIPTIONS[step]} />

      <StepIndicator step={step} onStepChange={(next) => void goTo(next)} />

      <Card>
        <CardContent className="space-y-5 pt-6">
          {step === 'details' ? (
            <div className="space-y-4">
              <JobFields control={wizard.details.control} autoFocus />
            </div>
          ) : null}

          {step === 'screening' ? <CriteriaFields form={wizard.screening} /> : null}

          {step === 'review' ? (
            <JobWizardReview
              details={wizard.details.getValues()}
              screening={wizard.screening.getValues()}
            />
          ) : null}
        </CardContent>
      </Card>

      {failure ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Job not created</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={abandon} disabled={wizard.isSubmitting}>
          Cancel
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {previous ? (
            <Button
              type="button"
              variant="outline"
              disabled={wizard.isSubmitting}
              onClick={() => void goTo(previous)}
            >
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
          ) : null}

          {step === 'review' ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={wizard.isSubmitting}
                onClick={() => void submit('draft')}
              >
                Save as draft
              </Button>
              <Button
                type="button"
                disabled={wizard.isSubmitting}
                onClick={() => void submit('published')}
              >
                <Check data-icon="inline-start" />
                {wizard.isSubmitting ? 'Publishing…' : 'Publish'}
              </Button>
            </>
          ) : next ? (
            <Button type="button" disabled={wizard.isSubmitting} onClick={() => void goTo(next)}>
              Next
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  step,
  onStepChange,
}: {
  step: WizardStep;
  onStepChange: (step: WizardStep) => void;
}) {
  const index = WIZARD_STEPS.indexOf(step);

  return (
    <nav aria-label="Steps">
      <ol className="flex flex-wrap items-center gap-2">
        {WIZARD_STEPS.map((each, position) => {
          const current = each === step;
          return (
            <li key={each} className="flex items-center gap-2">
              <Button
                type="button"
                variant={current ? 'secondary' : 'ghost'}
                size="sm"
                aria-current={current ? 'step' : undefined}
                onClick={() => onStepChange(each)}
              >
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border text-meta tabular-nums',
                    position < index
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border',
                  )}
                  aria-hidden="true"
                >
                  {position + 1}
                </span>
                {WIZARD_STEP_LABELS[each]}
              </Button>
              {position < WIZARD_STEPS.length - 1 ? (
                <span aria-hidden="true" className="h-px w-6 bg-border" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
