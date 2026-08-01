import type { ReactNode } from 'react';
import { PublicHeader } from '@/features/shell/components/public-header';

export const AUTH_LINK = 'font-medium text-accent-foreground underline underline-offset-4';

export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-12">
        <div className="space-y-1.5">
          <h1 className="font-heading text-h3 text-foreground">{title}</h1>
          {description ? <p className="text-dense text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
