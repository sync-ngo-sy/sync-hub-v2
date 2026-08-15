import { StatusMark } from '@sync/ui/components/status-mark';
import { Button } from '@sync/ui/components/ui/button';
import { useState } from 'react';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { type Application, applicationMeta, applicationState, canWithdraw } from '../application';
import { WithdrawApplicationDialog } from './withdraw-application-dialog';

export function ApplicationCard({ application }: { application: Application }) {
  const state = applicationState(application.status);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <article className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h2 className="truncate text-title text-foreground">{application.job.title}</h2>
          <p className="truncate text-meta text-muted-foreground">{applicationMeta(application)}</p>
          <p className="text-meta text-muted-foreground">
            Applied{' '}
            <time
              dateTime={application.applied_at}
              title={absoluteDateTime(application.applied_at)}
            >
              {relativeTime(application.applied_at)}
            </time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:justify-end sm:self-auto">
          <StatusMark tone={state.tone} label={state.label} />
          {canWithdraw(application.status) ? (
            <Button
              variant="destructive-outline"
              size="sm"
              aria-label={`Withdraw from “${application.job.title}”`}
              onClick={() => setConfirming(true)}
            >
              Withdraw
            </Button>
          ) : null}
        </div>
      </article>
      <WithdrawApplicationDialog
        application={application}
        open={confirming}
        onOpenChange={setConfirming}
      />
    </>
  );
}
