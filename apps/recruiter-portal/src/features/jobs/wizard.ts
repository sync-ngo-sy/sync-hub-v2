import { type CriteriaFormValues, criteriaFormSchema } from './schemas/criteria';
import { EMPTY_JOB, type JobFormValues, jobFormSchema } from './schemas/job';

export const WIZARD_STEPS = ['details', 'screening', 'review'] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export const WIZARD_STEP_VALUES = WIZARD_STEPS as unknown as [WizardStep, ...WizardStep[]];

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  details: 'Details',
  screening: 'Screening',
  review: 'Review',
};

export const EMPTY_SCREENING: CriteriaFormValues = {
  minimumTotalExperienceYears: '',
  skills: [],
  languages: [],
  questions: [],
};

export interface WizardDraft {
  details: JobFormValues;
  screening: CriteriaFormValues;
}

export const EMPTY_DRAFT: WizardDraft = { details: EMPTY_JOB, screening: EMPTY_SCREENING };

export const WIZARD_DRAFT_STORAGE_KEY = 'sync-recruiter-job-wizard';

export function readWizardDraft(): WizardDraft {
  const stored = globalThis.localStorage?.getItem(WIZARD_DRAFT_STORAGE_KEY);
  if (!stored) return EMPTY_DRAFT;

  try {
    const parsed = JSON.parse(stored) as Partial<WizardDraft>;
    return {
      details: jobFormSchema.partial().safeParse(parsed.details).success
        ? { ...EMPTY_JOB, ...parsed.details }
        : EMPTY_JOB,
      screening: criteriaFormSchema.safeParse(parsed.screening).success
        ? { ...EMPTY_SCREENING, ...parsed.screening }
        : EMPTY_SCREENING,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function reachableStep(draft: WizardDraft, wanted: WizardStep): WizardStep {
  if (wanted === 'details') return 'details';
  if (!jobFormSchema.safeParse(draft.details).success) return 'details';
  if (wanted === 'review' && !criteriaFormSchema.safeParse(draft.screening).success)
    return 'screening';
  return wanted;
}

export function writeWizardDraft(draft: WizardDraft) {
  globalThis.localStorage?.setItem(WIZARD_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function clearWizardDraft() {
  globalThis.localStorage?.removeItem(WIZARD_DRAFT_STORAGE_KEY);
}
