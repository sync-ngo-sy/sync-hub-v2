import { StatusMark } from '@sync/ui/components/status-mark';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Separator } from '@sync/ui/components/ui/separator';
import { cn } from '@sync/ui/lib/utils';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ReviewCard } from '@/features/shell/components/review-card';
import { problemDetail } from '@/lib/api-problem';
import { PIPELINE_STEPS, type PipelineStatus, pipelineState, pipelineStep } from '../application';
import { useMoveApplication } from '../hooks/use-application-actions';
import { type PipelineMove, pipelineMoveGroups, pipelineOutcome } from '../review';

interface ApplicationPipelineProps {
  applicationId: string;
  status: PipelineStatus;
}

const REJECTION = 'text-destructive hover:text-destructive';

export function ApplicationPipeline({ applicationId, status }: ApplicationPipelineProps) {
  const moving = useMoveApplication(applicationId);
  const [refusal, setRefusal] = useState<string | null>(null);
  const state = pipelineState(status);
  const step = pipelineStep(status);
  const groups = pipelineMoveGroups(status);
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
          <div className="flex items-center gap-2">
            {step ? (
              <span className="text-meta text-muted-foreground">
                Step {step} of {PIPELINE_STEPS}
              </span>
            ) : null}
            <StatusMark label={state.label} tone={state.tone} />
          </div>
        </div>

        {outcome ? <p className="text-dense text-muted-foreground">{outcome}</p> : null}

        {refusal ? (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Move refused</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        ) : null}

        {groups.map((group, groupIndex) => (
          <div key={group.direction} className="flex flex-col gap-2">
            {groupIndex > 0 ? <Separator className="mb-2" /> : null}
            {group.moves.map((move, moveIndex) => (
              <Button
                key={move.label}
                variant={groupIndex === 0 && moveIndex === 0 ? 'default' : 'outline'}
                className={cn('justify-start', move.direction === 'rejection' && REJECTION)}
                disabled={moving.isPending}
                onClick={() => void makeMove(move)}
              >
                <move.icon aria-hidden="true" />
                <span aria-hidden="true" className="w-3 text-meta text-muted-foreground">
                  {pipelineStep(move.target)}
                </span>
                {move.label}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </ReviewCard>
  );
}
