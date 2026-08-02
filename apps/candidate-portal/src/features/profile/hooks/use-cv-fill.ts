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
  /** Fills the form from a CV. Writes nothing — Save is still the only thing that does. */
  from: (cv: Cv) => Promise<void>;
  /** The CV a fill is in flight for, so the card that asked says so. */
  pending: string | null;
  /** The CV that filled the form, while the notice about it is still up. */
  filledBy: string | null;
  /** Puts back exactly what the form held before the fill. */
  undo: () => void;
  dismiss: () => void;
  /** Why a fill did not happen, said where the CV that refused it is. */
  refusal: string | null;
}

/**
 * A fill, and the way back from it. The snapshot is what replaces the dialog this used to open:
 * instead of summarising the edits to a form nobody could see, the values land in the fields and
 * the candidate reads them in context — with one action that restores what was there before.
 */
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
        reportError(error, { boundary: 'widget', source: 'Profile draft' });
        const message = problemMessage(error, "This CV couldn't fill the form. Try again.");
        // A CV the API turns down is about that CV, so it is said beside it. A fault on our side
        // is nobody's CV, and goes to Sonner instead (§7.2, §7.3).
        if (isClientError(error)) setRefusal(message);
        else toast.error(message);
      }
    },
    [draft, getValues, reset],
  );

  const undo = useCallback(() => {
    if (!filled) return;
    reset(filled.before, { keepDefaultValues: true });
    setFilled(null);
  }, [filled, reset]);

  return {
    from,
    pending: draft.isPending ? (draft.variables ?? null) : null,
    filledBy: filled?.cvName ?? null,
    undo,
    dismiss: () => setFilled(null),
    refusal,
  };
}
