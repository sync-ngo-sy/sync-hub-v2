import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { SkeletonText } from '@sync/ui/components/skeletons';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { CircleAlert } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import type { Cv } from '../cv';
import {
  type CandidateProfile,
  draftChanges,
  type ProfileDraft,
  profileFromDraft,
  skillsNeedingYears,
} from '../draft-changes';
import { useApplyDraft, useProfileDraft } from '../hooks/use-profile-draft';
import { type ReviewValues, reviewSchema } from '../schemas/review';

interface DraftReviewDialogProps {
  cv: Cv | null;
  onClose: () => void;
}

export function DraftReviewDialog({ cv, onClose }: DraftReviewDialogProps) {
  const { draft, profile } = useProfileDraft(cv?.id ?? null);

  return (
    <Dialog open={cv !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fill your profile from “{cv?.display_name}”</DialogTitle>
          <DialogDescription>
            Nothing is saved until you say so. Review what this CV would change first.
          </DialogDescription>
        </DialogHeader>

        {draft.isPending || profile.isPending ? <SkeletonText lines={4} /> : null}

        {draft.error || profile.error ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Couldn't read this CV's draft</AlertTitle>
            <AlertDescription>
              {problemMessage(draft.error ?? profile.error, 'Try again in a moment.')}
            </AlertDescription>
          </Alert>
        ) : null}

        {draft.data && profile.data ? (
          <DraftReview draft={draft.data} profile={profile.data} onApplied={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Mounted only once both halves are in, so the years fields start from the real draft. */
function DraftReview({
  draft,
  profile,
  onApplied,
}: {
  draft: ProfileDraft;
  profile: CandidateProfile;
  onApplied: () => void;
}) {
  const apply = useApplyDraft();
  const changes = draftChanges(profile, draft);

  const { control, handleSubmit, formState } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      skills: skillsNeedingYears(draft).map((name) => ({ name, years: '' })),
    },
  });
  const { fields } = useFieldArray({ control, name: 'skills' });

  const submit = handleSubmit(async (values) => {
    const years = Object.fromEntries(values.skills.map(({ name, years }) => [name, Number(years)]));
    try {
      await apply.mutateAsync({ body: profileFromDraft(draft, years) });
      toast.success('Your profile now says what this CV says.');
      onApplied();
    } catch (error) {
      toast.error(problemMessage(error, "Couldn't save your profile. Try again."));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {changes.length === 0 ? (
        <p className="text-dense text-muted-foreground">
          This CV says nothing your profile does not already say.
        </p>
      ) : (
        <div className="space-y-3">
          <ul aria-label="What would change" className="divide-y divide-border border-y">
            {changes.map((change) => (
              <li key={change.label} className="grid grid-cols-3 items-baseline gap-3 py-2.5">
                <span className="text-dense font-medium text-foreground">{change.label}</span>
                <span className="text-dense text-muted-foreground line-through">
                  {change.before}
                </span>
                <span className="text-dense text-foreground">{change.after}</span>
              </li>
            ))}
          </ul>
          <p className="text-meta text-muted-foreground">
            Every section listed is replaced by what the CV says, not merged with it.
          </p>
        </div>
      )}

      {fields.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="text-dense font-medium text-foreground">
            New skills need your years
          </legend>
          <p className="text-meta text-muted-foreground">
            This CV names skills your profile did not. Blank and zero are different answers, so only
            you can say which.
          </p>
          {fields.map((field, index) => (
            <FormField
              key={field.id}
              control={control}
              name={`skills.${index}.years`}
              label={`${field.name} — years of experience`}
            >
              {(control) => <Input {...control} inputMode="decimal" placeholder="3" />}
            </FormField>
          ))}
        </fieldset>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Applying…' : 'Apply to profile'}
        </Button>
      </DialogFooter>
    </form>
  );
}
