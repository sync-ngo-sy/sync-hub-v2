import { StatusMark } from '@sync/ui/components/status-mark';
import { TenantLogo } from '@sync/ui/components/tenant-logo';
import { Button } from '@sync/ui/components/ui/button';
import { useState } from 'react';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { type Application, applicationMeta, applicationState } from '../application';
import { HireClaim } from './hire-claim';
import { WithdrawApplicationDialog } from './withdraw-application-dialog';

export function ApplicationCard({ application }: { application: Application }) {
  const state = applicationState(application.stage);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <article className="space-y-4 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <TenantLogo
              name={application.job.tenant.name}
              logoUrl={application.job.tenant.logo_url}
            />
            <div className="min-w-0 space-y-1.5">
              <h2 className="truncate text-title text-foreground">{application.job.title}</h2>
              <p className="truncate text-meta text-muted-foreground">
                {applicationMeta(application)}
              </p>
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
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:justify-end sm:self-auto">
            <StatusMark tone={state.tone} label={state.label} />
            {application.can_withdraw ? (
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
        </div>

        <HireClaim application={application} />
      </article>
      <WithdrawApplicationDialog
        application={application}
        open={confirming}
        onOpenChange={setConfirming}
      />
    </>
  );
}
