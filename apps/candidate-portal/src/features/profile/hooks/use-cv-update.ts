import { useCallback, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import type { Cv } from '@/features/cvs/cv';
import { useProfileDraft } from '@/features/cvs/hooks/use-profile-draft';
import { isClientError, problemMessage } from '@/lib/api-problem';
import { reportError } from '@/lib/report-error';
import { updatedFromCv } from '../cv-update';
import type { ProfileFormValues } from '../schemas/profile';

interface Form {
  getValues: UseFormReturn<ProfileFormValues>['getValues'];
  reset: UseFormReturn<ProfileFormValues>['reset'];
}

export interface CvUpdate {
  from: (cv: Cv) => Promise<void>;
  pending: string | null;
  updatedBy: string | null;
  undo: () => void;
  dismiss: () => void;
  refusal: string | null;
}

export function useCvUpdate({ getValues, reset }: Form): CvUpdate {
  const draft = useProfileDraft();
  const [updated, setUpdated] = useState<{ cvName: string; before: ProfileFormValues } | null>(
    null,
  );
  const [refusal, setRefusal] = useState<string | null>(null);

  const from = useCallback(
    async (cv: Cv) => {
      setRefusal(null);
      const before = getValues();
      try {
        const values = updatedFromCv(before, await draft.mutateAsync(cv.id));
        reset(values, { keepDefaultValues: true });
        setUpdated({ cvName: cv.display_name, before });
      } catch (error) {
        const message = problemMessage(error, "This CV couldn't update the form. Try again.");
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
    if (!updated) return;
    reset(updated.before, { keepDefaultValues: true });
    setUpdated(null);
  }, [updated, reset]);

  const dismiss = useCallback(() => {
    setUpdated(null);
    setRefusal(null);
  }, []);

  return {
    from,
    pending: draft.isPending ? (draft.variables ?? null) : null,
    updatedBy: updated?.cvName ?? null,
    undo,
    dismiss,
    refusal,
  };
}
