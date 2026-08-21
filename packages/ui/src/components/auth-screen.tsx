import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { microLabel } from '@sync/ui/lib/micro-label';
import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';
import { FormSkeleton, RouteSkeleton } from './skeletons';

export const AUTH_LINK = 'font-medium text-accent-foreground underline underline-offset-4';

const AUTH_FRAME = 'flex min-h-dvh flex-col';

const AUTH_COLUMN = 'mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-12';

export function AuthScreen({
  header,
  title,
  description,
  children,
}: {
  header: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={AUTH_FRAME}>
      {header}
      <main className={AUTH_COLUMN}>
        <div className="space-y-3">
          <p
            className={cn(
              microLabel,
              'flex items-center gap-2.5 font-semibold text-accent-foreground',
            )}
          >
            <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-accent-foreground" />
            Sync Hub
          </p>
          <div className="space-y-1.5">
            <h1 className="font-heading text-h2 text-foreground">{title}</h1>
            {description ? <p className="text-dense text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function AuthScreenSkeleton({
  header,
  fields = 2,
  submit = true,
}: {
  header: ReactNode;
  fields?: number;
  submit?: boolean;
}) {
  return (
    <div className={AUTH_FRAME}>
      {header}
      <main className={AUTH_COLUMN}>
        <RouteSkeleton label="Loading" className="space-y-6">
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-full" />
          </div>
          <FormSkeleton fields={fields} submit={submit} />
        </RouteSkeleton>
      </main>
    </div>
  );
}

export function CheckEmailScreen({
  header,
  children,
  backAction,
}: {
  header: ReactNode;
  children: ReactNode;
  backAction: ReactNode;
}) {
  return (
    <AuthScreen header={header} title="Check your email" description={children}>
      <div>{backAction}</div>
    </AuthScreen>
  );
}

export function DeadLinkScreen({
  header,
  description,
  action,
}: {
  header: ReactNode;
  description: string;
  action: ReactNode;
}) {
  return (
    <AuthScreen header={header} title="This link didn't work" description={description}>
      <div>{action}</div>
    </AuthScreen>
  );
}

export function SentTo({ email }: { email: string }) {
  return <strong className="font-medium text-foreground">{email}</strong>;
}
