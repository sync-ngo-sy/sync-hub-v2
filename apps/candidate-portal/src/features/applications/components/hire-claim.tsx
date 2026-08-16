import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { problemMessage } from '@/lib/api-problem';
import { calendarDay } from '@/lib/dates';
import { type Application, hireAnswerLine } from '../application';
import { useAnswerHireClaim } from '../hooks/use-application-actions';

export function HireClaim({ application }: { application: Application }) {
  const answering = useAnswerHireClaim();
  const hire = application.hire;

  if (!hire) return null;

  const answered = hireAnswerLine(hire);

  function answer(confirmed: boolean) {
    answering.mutate({
      params: { path: { application_id: application.id } },
      body: { confirmed },
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
      <p className="text-dense text-foreground">
        {application.job.tenant.name} says you started this job on{' '}
        <time dateTime={hire.start_date}>{calendarDay(hire.start_date)}</time>.
      </p>

      {answered ? (
        <p className="text-meta text-muted-foreground">{answered}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={answering.isPending} onClick={() => answer(true)}>
              Yes, I started
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={answering.isPending}
              onClick={() => answer(false)}
            >
              No, I didn't
            </Button>
          </div>
          <p className="text-meta text-muted-foreground">
            Nothing counts as a placement until you say so, and you answer once.
          </p>
        </>
      )}

      {answering.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Answer not saved</AlertTitle>
          <AlertDescription>
            {problemMessage(answering.error, "That answer couldn't be saved.")}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
