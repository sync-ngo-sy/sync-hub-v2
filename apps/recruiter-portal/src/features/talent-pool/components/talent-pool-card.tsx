import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { CircleAlert, Star, StarOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { ReviewCard } from '@/features/shell/components/review-card';
import { problemDetail, problemMessage } from '@/lib/api-problem';
import { useTalentPool, useTalentPoolActions } from '../hooks/use-talent-pool';

const HINT = 'People your team wants to reach again, whether or not they have ever applied.';

function label(saved: boolean, isChanging: boolean): string {
  if (isChanging) return saved ? 'Dropping…' : 'Saving…';
  return saved ? 'Drop from talent pool' : 'Save to talent pool';
}

interface TalentPoolCardProps {
  candidateId: string;
  candidateName: string;
}

export function TalentPoolCard({ candidateId, candidateName }: TalentPoolCardProps) {
  const pool = useTalentPool();
  const actions = useTalentPoolActions();
  const [failure, setFailure] = useState<string | null>(null);
  const saved = pool.holds(candidateId);

  async function change() {
    if (actions.isChanging) return;
    setFailure(null);
    try {
      if (saved) {
        await actions.drop(candidateId);
        toast.success(`${candidateName} dropped from your talent pool`);
      } else {
        await actions.save(candidateId);
        toast.success(`${candidateName} saved to your talent pool`);
      }
    } catch (error) {
      setFailure(
        problemDetail(
          error,
          saved
            ? "That Candidate couldn't be dropped. Your talent pool is as it was."
            : "That Candidate couldn't be saved. Your talent pool is as it was.",
        ),
      );
    }
  }

  return (
    <ReviewCard title="Talent pool" hint={HINT}>
      <div className="space-y-4">
        {pool.error ? (
          <RetryNotice
            message={problemMessage(pool.error, "Couldn't read your talent pool.")}
            onRetry={pool.refetch}
          />
        ) : null}

        {pool.isPending ? (
          <div aria-hidden="true" className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-44" />
          </div>
        ) : null}

        {failure ? (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Talent pool unchanged</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}

        {!pool.isPending && !pool.error ? (
          <>
            <p className="text-dense text-foreground">
              {saved
                ? `${candidateName} is in your talent pool.`
                : `${candidateName} is not in your talent pool.`}
            </p>
            <Button
              variant={saved ? 'outline' : 'default'}
              disabled={actions.isChanging}
              onClick={() => void change()}
            >
              {saved ? <StarOff aria-hidden="true" /> : <Star aria-hidden="true" />}
              {label(saved, actions.isChanging)}
            </Button>
          </>
        ) : null}
      </div>
    </ReviewCard>
  );
}
