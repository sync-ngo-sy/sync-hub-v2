import { StatusMark } from '@sync/ui/components/status-mark';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { cn } from '@sync/ui/lib/utils';
import { CircleAlert, MoreHorizontal } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { problemDetail } from '@/lib/api-problem';
import {
  PIPELINE_LADDER,
  PIPELINE_STEPS,
  type PipelineStatus,
  pipelineState,
  pipelineStep,
} from '../application';
import { useMoveApplication } from '../hooks/use-application-actions';
import { type PipelineMove, pipelineMoveChoices, pipelineOutcome } from '../review';

interface ApplicationPipelineProps {
  applicationId: string;
  status: PipelineStatus;
}

export function ApplicationPipeline({ applicationId, status }: ApplicationPipelineProps) {
  const headingId = useId();
  const moving = useMoveApplication(applicationId);
  const [refusal, setRefusal] = useState<string | null>(null);
  const state = pipelineState(status);
  const step = pipelineStep(status);
  const choices = pipelineMoveChoices(status);
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
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className="border-b border-border pb-(--card-spacing)">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>
                <h2 id={headingId}>Pipeline</h2>
              </CardTitle>
              <div className="flex items-center gap-2">
                <StatusMark label={state.label} tone={state.tone} />
                {step ? (
                  <span className="text-meta text-muted-foreground">
                    Step {step} of {PIPELINE_STEPS}
                  </span>
                ) : null}
              </div>
            </div>

            {choices.adjacent.length > 0 || choices.other.length > 0 ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {choices.adjacent.map((move, index) => (
                  <Button
                    key={move.label}
                    size="sm"
                    variant={index === choices.adjacent.length - 1 ? 'default' : 'outline'}
                    disabled={moving.isPending}
                    onClick={() => void makeMove(move)}
                  >
                    <move.icon aria-hidden="true" />
                    <span aria-hidden="true" className="text-meta opacity-65">
                      {pipelineStep(move.target)}
                    </span>
                    {move.label}
                  </Button>
                ))}

                {choices.other.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={moving.isPending}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <MoreHorizontal aria-hidden="true" />
                      More moves
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {choices.other.map((move) => (
                        <DropdownMenuItem
                          key={move.label}
                          variant={move.direction === 'rejection' ? 'destructive' : 'default'}
                          onClick={() => void makeMove(move)}
                        >
                          <move.icon aria-hidden="true" />
                          <span className="flex-1">{move.label}</span>
                          {pipelineStep(move.target) ? (
                            <span className="text-meta text-muted-foreground">
                              {pipelineStep(move.target)}
                            </span>
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <ol aria-label="Pipeline progress" className="grid grid-cols-6 gap-1.5">
            {PIPELINE_LADDER.map((pipelineStatus, index) => {
              const stageStep = index + 1;
              const isCurrent = step === stageStep;
              const isReached = step !== null && stageStep <= step;

              return (
                <li key={pipelineStatus} className="min-w-0 space-y-1.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'block h-1 rounded-full bg-border',
                      isReached && 'bg-primary',
                      isCurrent && 'bg-deep',
                    )}
                  />
                  <span
                    className={cn(
                      'block truncate text-meta text-muted-foreground',
                      isCurrent && 'font-medium text-foreground',
                    )}
                  >
                    {pipelineState(pipelineStatus).label}
                    {isCurrent ? ' · now' : ''}
                  </span>
                </li>
              );
            })}
          </ol>

          {outcome ? <p className="text-dense text-muted-foreground">{outcome}</p> : null}

          {refusal ? (
            <Alert>
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Move refused</AlertTitle>
              <AlertDescription>{refusal}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
