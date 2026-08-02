import { useCallback, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import type { Cv } from '@/features/cvs/cv';
import { useProfileDraft } from '@/features/cvs/hooks/use-profile-draft';
import { isClientError, problemMessage } from '@/lib/api-problem';
import { reportError } from '@/lib/report-error';
import { filledFromCv } from '../fill';
import type { ProfileFormValues } from '../schemas/profile';

interface Form {
  getValues: UseFormReturn<ProfileFormValues>['getValues'];
  reset: UseFormReturn<ProfileFormValues>['reset'];
}

export interface Fill {
  from: (cv: Cv) => Promise<void>;
  /** The CV a fill is in flight for, and the one the notice is about. */
  pending: string | null;
  filledBy: string | null;
  undo: () => void;
  /** Drops the notice and any refusal, keeping whatever the fields now hold. */
  dismiss: () => void;
  refusal: string | null;
}

/** A fill, and the way back from it: the snapshot is what replaces the review dialog. */
export function useCvFill({ getValues, reset }: Form): Fill {
  const draft = useProfileDraft();
  const [filled, setFilled] = useState<{ cvName: string; before: ProfileFormValues } | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const from = useCallback(
    async (cv: Cv) => {
      setRefusal(null);
      const before = getValues();
      try {
        const values = filledFromCv(before, await draft.mutateAsync(cv.id));
        // `keepDefaultValues` is what makes a fill an unsaved change like any other: the defaults
        // stay the profile the API answered with, so the form reads as dirty and leaving asks.
        reset(values, { keepDefaultValues: true });
        setFilled({ cvName: cv.display_name, before });
      } catch (error) {
        const message = problemMessage(error, "This CV couldn't fill the form. Try again.");
        // A CV the API turns down is an answer about that CV, so it is said beside it and not
        // reported. A fault on our side is nobody's CV: it goes to Sonner, and to the seam every
        // other tier reports through (§7.2, §7.3).
        if (isClientError(error)) {
          setRefusal(message);
          return;
        }
        reportError(error, { boundary: 'widget', source: 'Profile draft' });
        toast.error(message);
      }
    },
    [draft, getValues, reset],
  );

  const undo = useCallback(() => {
    if (!filled) return;
    reset(filled.before, { keepDefaultValues: true });
    setFilled(null);
  }, [filled, reset]);

  const dismiss = useCallback(() => {
    setFilled(null);
    setRefusal(null);
  }, []);

  return {
    from,
    pending: draft.isPending ? (draft.variables ?? null) : null,
    filledBy: filled?.cvName ?? null,
    undo,
    dismiss,
    refusal,
  };
}
