import { EmptyState } from '@sync/ui/components/empty-state';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteCv } from '../hooks/use-delete-cv';
import { useMakeCurrentCv } from '../hooks/use-make-current-cv';
import { deleteErrorMessage } from '../messages';
import type { Cv } from '../status';
import { ConfirmDialog } from './confirm-dialog';
import { CvCard } from './cv-card';
import { DraftReviewDialog } from './draft-review-dialog';

export function CvList({ cvs }: { cvs: Cv[] }) {
  const [reviewCv, setReviewCv] = useState<Cv | null>(null);
  const [currentTarget, setCurrentTarget] = useState<Cv | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cv | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const makeCurrent = useMakeCurrentCv();
  const remove = useDeleteCv();

  async function confirmMakeCurrent() {
    if (!currentTarget) return;
    setCurrentError(null);
    try {
      await makeCurrent.makeCurrent(currentTarget.id);
      toast.success(`${currentTarget.display_name} is now your Current CV.`);
      setCurrentTarget(null);
    } catch {
      setCurrentError("That CV couldn't be made current. Try again.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await remove.deleteCv(deleteTarget.id);
      toast.success('CV deleted.');
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(deleteErrorMessage(error));
    }
  }

  if (cvs.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No CVs yet"
        description="Upload your first CV above. Sync reads it and can fill your profile from it."
      />
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {cvs.map((cv) => (
          <li key={cv.id}>
            <CvCard
              cv={cv}
              onReview={setReviewCv}
              onMakeCurrent={(target) => {
                setCurrentError(null);
                setCurrentTarget(target);
              }}
              onDelete={(target) => {
                setDeleteError(null);
                setDeleteTarget(target);
              }}
            />
          </li>
        ))}
      </ul>

      <DraftReviewDialog
        cvId={reviewCv?.id ?? null}
        cvName={reviewCv?.display_name ?? null}
        onOpenChange={(open) => {
          if (!open) setReviewCv(null);
        }}
      />

      <ConfirmDialog
        open={currentTarget != null}
        onOpenChange={(open) => {
          if (!open) setCurrentTarget(null);
        }}
        title="Make this your Current CV?"
        description={
          currentTarget
            ? `You'll apply to Jobs and be found by recruiters with ${currentTarget.display_name}. Applications you've already submitted keep the CV they used.`
            : ''
        }
        confirmLabel="Make current"
        pending={makeCurrent.mutation.isPending}
        error={currentError}
        onConfirm={confirmMakeCurrent}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this CV?"
        description={
          deleteTarget
            ? `${deleteTarget.display_name} will be removed for good. This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        pending={remove.mutation.isPending}
        error={deleteError}
        onConfirm={confirmDelete}
      />
    </>
  );
}
