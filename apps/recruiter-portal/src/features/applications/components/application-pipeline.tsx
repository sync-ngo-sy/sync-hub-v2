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
import { ArrowLeft, ArrowRight, CircleAlert, CircleX, MoreHorizontal } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { problemDetail } from '@/lib/api-problem';
import { PIPELINE_LADDER, type PipelineStatus, pipelineState, pipelineStep } from '../application';
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
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>
              <h2 id={headingId}>Pipeline</h2>
            </CardTitle>
            <StatusMark label={state.label} tone={state.tone} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {choices.adjacent.length > 0 || choices.other.length > 0 ? (
            <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              {choices.adjacent.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:col-start-2">
                  {choices.adjacent.map((move, index) => (
                    <Button
                      key={move.label}
                      size="sm"
                      variant={index === choices.adjacent.length - 1 ? 'default' : 'outline'}
                      disabled={moving.isPending}
                      onClick={() => void makeMove(move)}
                    >
                      {move.direction === 'back' ? <ArrowLeft aria-hidden="true" /> : null}
                      {move.label}
                      {move.direction === 'onward' ? <ArrowRight aria-hidden="true" /> : null}
                    </Button>
                  ))}
                </div>
              ) : null}

              {choices.other.length > 0 ? (
                <div className="flex justify-center sm:col-start-3 sm:justify-end">
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
                          {move.direction === 'back' ? <ArrowLeft aria-hidden="true" /> : null}
                          {move.direction === 'rejection' ? <CircleX aria-hidden="true" /> : null}
                          <span className="flex-1">{move.label}</span>
                          {move.direction === 'onward' ? <ArrowRight aria-hidden="true" /> : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </div>
          ) : null}

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
                      isCurrent && 'bg-deep dark:bg-deep-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'block truncate text-meta text-muted-foreground',
                      isCurrent && 'font-medium text-foreground',
                    )}
                  >
                    {pipelineState(pipelineStatus).label}
                    {isCurrent ? (
                      <>
                        <span className="text-muted-foreground"> · </span>
                        <span className="inline-flex items-center gap-1 text-primary">
                          <span
                            aria-hidden="true"
                            className="size-1.5 rounded-full bg-current motion-safe:animate-pulse"
                          />
                          now
                        </span>
                      </>
                    ) : null}
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
