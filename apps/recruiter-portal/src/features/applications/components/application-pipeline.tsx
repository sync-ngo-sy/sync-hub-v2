import { StatusMark } from '@sync/ui/components/status-mark';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
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
import { calendarDay } from '@/lib/dates';
import { PIPELINE_LADDER, type PipelineStatus, pipelineState, pipelineStep } from '../application';
import { useMoveApplication } from '../hooks/use-application-actions';
import {
  type HireClaim,
  hireState,
  moveOutcome,
  type PipelineMove,
  pipelineMoveChoices,
  pipelineOutcome,
  telling,
} from '../review';
import { MarkAsHiredDialog } from './mark-as-hired-dialog';

interface ApplicationPipelineProps {
  applicationId: string;
  status: PipelineStatus;
  hire: HireClaim | null;
  toldAt: string | null;
}

export function ApplicationPipeline({
  applicationId,
  status,
  hire,
  toldAt,
}: ApplicationPipelineProps) {
  const headingId = useId();
  const moving = useMoveApplication(applicationId);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<PipelineMove | null>(null);
  const state = pipelineState(status);
  const step = pipelineStep(status);
  const choices = pipelineMoveChoices(status);
  const outcome = pipelineOutcome(status);
  const theTelling = telling(status, toldAt);
  const onlyMenu = choices.adjacent.length === 0;

  async function makeMove(move: PipelineMove, startDate?: string) {
    const moved = await moving.mutateAsync({
      params: { path: { application_id: applicationId } },
      body: { status: move.target, start_date: startDate ?? null },
    });
    toast.success(moveOutcome(move, moved));
  }

  // A hire is a claim about a particular day, so it asks for one before it is made — and a
  // refusal belongs in that dialog. Every other move goes straight through, and reports back
  // on the card.
  function choose(move: PipelineMove) {
    setRefusal(null);
    if (move.target === 'hired') {
      setClaiming(move);
      return;
    }
    void makeMove(move).catch((error: unknown) => {
      setRefusal(
        problemDetail(
          error,
          `This Application couldn't move to ${pipelineState(move.target).label}.`,
        ),
      );
    });
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

          {choices.adjacent.length > 0 || choices.other.length > 0 ? (
            <CardAction className="flex flex-wrap items-center justify-end gap-2 self-center">
              {choices.other.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={moving.isPending}
                    className={buttonVariants({
                      variant: 'outline',
                      size: onlyMenu ? 'sm' : 'icon-sm',
                    })}
                  >
                    <MoreHorizontal
                      aria-hidden="true"
                      data-icon={onlyMenu ? 'inline-start' : undefined}
                    />
                    <span className={cn(!onlyMenu && 'sr-only')}>More moves</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {choices.other.map((move) => (
                      <DropdownMenuItem
                        key={move.label}
                        variant={move.direction === 'rejection' ? 'destructive' : 'default'}
                        onClick={() => choose(move)}
                      >
                        {move.direction === 'back' ? <ArrowLeft aria-hidden="true" /> : null}
                        {move.direction === 'rejection' ? <CircleX aria-hidden="true" /> : null}
                        <span className="flex-1">{move.label}</span>
                        {move.direction === 'onward' ? <ArrowRight aria-hidden="true" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              {choices.adjacent.map((move, index) => (
                <Button
                  key={move.label}
                  size="sm"
                  variant={index === choices.adjacent.length - 1 ? 'default' : 'outline'}
                  disabled={moving.isPending}
                  onClick={() => choose(move)}
                >
                  {move.direction === 'back' ? (
                    <ArrowLeft aria-hidden="true" data-icon="inline-start" />
                  ) : null}
                  {move.label}
                  {move.direction === 'onward' ? (
                    <ArrowRight aria-hidden="true" data-icon="inline-end" />
                  ) : null}
                </Button>
              ))}
            </CardAction>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          <ol aria-label="Pipeline progress" className="grid grid-cols-6 gap-1.5">
            {PIPELINE_LADDER.map((pipelineStatus, index) => {
              const place = index + 1;
              const isCurrent = step === place;
              const isReached = step !== null && place <= step;

              return (
                <li
                  key={pipelineStatus}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="min-w-0 space-y-1.5"
                >
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
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
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

          {theTelling && !theTelling.told ? (
            <p className="text-dense text-muted-foreground">{theTelling.text}</p>
          ) : null}

          {theTelling?.told ? (
            <Alert>
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Already told</AlertTitle>
              <AlertDescription>{theTelling.text}</AlertDescription>
            </Alert>
          ) : null}

          {hire ? (
            <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-dense text-foreground">
                Started <time dateTime={hire.start_date}>{calendarDay(hire.start_date)}</time>
              </p>
              <p className="text-meta text-muted-foreground">{hireState(hire)}</p>
            </div>
          ) : null}

          {refusal ? (
            <Alert>
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Move refused</AlertTitle>
              <AlertDescription>{refusal}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {claiming ? (
        <MarkAsHiredDialog
          onClose={() => setClaiming(null)}
          onConfirm={async (startDate) => {
            await makeMove(claiming, startDate);
            setClaiming(null);
          }}
        />
      ) : null}
    </section>
  );
}
