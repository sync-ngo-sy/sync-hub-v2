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
  pending: string | null;
  filledBy: string | null;
  undo: () => void;
  dismiss: () => void;
  refusal: string | null;
}

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
        reset(values, { keepDefaultValues: true });
        setFilled({ cvName: cv.display_name, before });
      } catch (error) {
        const message = problemMessage(error, "This CV couldn't fill the form. Try again.");
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
