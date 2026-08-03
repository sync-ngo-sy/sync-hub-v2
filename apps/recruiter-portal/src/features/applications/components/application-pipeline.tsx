import { StatusChip } from '@sync/ui/components/status-chip';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { problemDetail } from '@/lib/api-problem';
import { type PipelineStatus, pipelineState } from '../application';
import { useMoveApplication } from '../hooks/use-application-actions';
import { type PipelineMove, pipelineMoves, pipelineOutcome } from '../review';
import { ReviewCard } from './review-card';

interface ApplicationPipelineProps {
  applicationId: string;
  status: PipelineStatus;
}

export function ApplicationPipeline({ applicationId, status }: ApplicationPipelineProps) {
  const moving = useMoveApplication(applicationId);
  const [refusal, setRefusal] = useState<string | null>(null);
  const state = pipelineState(status);
  const moves = pipelineMoves(status);
  const outcome = pipelineOutcome(status);

  async function makeMove(move: PipelineMove) {
    setRefusal(null);
    try {
      await moving.mutateAsync({
        params: { path: { application_id: applicationId } },
        body: { status: move.target },
      });
      toast.success(move.success);
    } catch (error) {
      setRefusal(
        problemDetail(
          error,
          `This Application couldn't move to ${pipelineState(move.target).label}.`,
        ),
      );
    }
  }

  return (
    <ReviewCard title="Pipeline">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-meta text-muted-foreground">Current</span>
          <StatusChip label={state.label} tone={state.tone} />
        </div>

        {outcome ? <p className="text-dense text-muted-foreground">{outcome}</p> : null}

        {refusal ? (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Move refused</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        ) : null}

        {moves.length > 0 ? (
          <div className="flex flex-col gap-2">
            {moves.map((move, index) => (
              <Button
                key={move.label}
                variant={index === 0 ? 'default' : 'outline'}
                disabled={moving.isPending}
                onClick={() => void makeMove(move)}
              >
                {move.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </ReviewCard>
  );
}
