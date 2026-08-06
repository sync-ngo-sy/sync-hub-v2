import { ListSkeleton } from '@sync/ui/components/skeletons';
import { useEffect, useRef, useState } from 'react';
import { ErrorCard } from '@/features/shell/components/error-card';
import { type Cv, isParsing, isReady, slotsLeft } from '../cv';
import { useMyCvs } from '../hooks/use-my-cvs';
import { CvCard } from './cv-card';
import { CvUploader } from './cv-uploader';

interface CvsSectionProps {
  onFill: (cv: Cv) => void;
  filling: string | null;
}

export function CvsSection({ onFill, filling }: CvsSectionProps) {
  const cvs = useMyCvs();
  const [awaited, setAwaited] = useState<string | null>(null);
  const alreadyFilled = useRef<string | null>(null);

  useEffect(() => {
    if (!awaited || alreadyFilled.current === awaited) return;
    const cv = cvs.data?.find((entry) => entry.id === awaited);
    if (!cv || isParsing(cv)) return;
    alreadyFilled.current = awaited;
    setAwaited(null);
    if (isReady(cv)) onFill(cv);
  }, [awaited, cvs.data, onFill]);

  return (
    <div className="space-y-5">
      {cvs.data ? (
        <CvUploader
          slotsLeft={slotsLeft(cvs.data)}
          hasCvs={cvs.data.length > 0}
          onUploaded={(cv) => setAwaited(cv.id)}
        />
      ) : null}

      {cvs.isPending ? (
        <div role="status" aria-label="Loading your CVs">
          <ListSkeleton rows={2} />
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
              <CvCard cv={cv} onFill={onFill} filling={filling === cv.id} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
