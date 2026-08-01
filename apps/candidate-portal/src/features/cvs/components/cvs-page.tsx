import { PageHeader } from '@sync/ui/components/page-header';
import { ListSkeleton } from '@sync/ui/components/skeletons';
import { useState } from 'react';
import { ErrorCard } from '@/features/shell/components/error-card';
import { type Cv, MAX_CVS, slotsLeft } from '../cv';
import { useMyCvs } from '../hooks/use-my-cvs';
import { CvCard } from './cv-card';
import { CvUploader } from './cv-uploader';
import { DraftReviewDialog } from './draft-review-dialog';

export function CvsPage() {
  const cvs = useMyCvs();
  const [reviewing, setReviewing] = useState<Cv | null>(null);

  return (
    <div className="space-y-8">
      <PageHeader
        title="CVs"
        description={`Keep up to ${MAX_CVS}. The current one goes out with every application you send, and is the one recruiters searching the platform find you by.`}
      />

      {cvs.data ? (
        <CvUploader slotsLeft={slotsLeft(cvs.data)} hasCvs={cvs.data.length > 0} />
      ) : null}

      {cvs.isPending ? (
        <div role="status" aria-label="Loading your CVs">
          <ListSkeleton rows={3} />
        </div>
      ) : null}

      {cvs.isError ? (
        <ErrorCard
          title="Couldn't load your CVs"
          description="The list didn't load. Nothing has been lost."
          onRetry={() => void cvs.refetch()}
        />
      ) : null}

      {cvs.data && cvs.data.length > 0 ? (
        <ul aria-label="Your CVs" className="space-y-4">
          {cvs.data.map((cv) => (
            <li key={cv.id}>
              <CvCard cv={cv} onReview={setReviewing} />
            </li>
          ))}
        </ul>
      ) : null}

      <DraftReviewDialog cv={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}
