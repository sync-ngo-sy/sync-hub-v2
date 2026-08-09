import { microLabel } from '@sync/ui/lib/micro-label';
import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';

export const AUTH_LINK = 'font-medium text-accent-foreground underline underline-offset-4';

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
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-12">
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
