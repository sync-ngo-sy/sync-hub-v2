import { PageHeaderShell } from '@sync/ui/components/page-header';
import type { ReactNode } from 'react';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';

interface CandidatePageHeaderProps {
  name: string;
  breadcrumbs: ReactNode;
  actions?: ReactNode;
  contextLabel?: string;
}

export function CandidatePageHeader({
  name,
  breadcrumbs,
  actions,
  contextLabel,
}: CandidatePageHeaderProps) {
  return (
    <WorkspaceHeader>
      {breadcrumbs}

      <PageHeaderShell className="mt-4" actions={actions}>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-heading text-page-title text-foreground">{name}</h1>
          {contextLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-meta font-medium text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              {contextLabel}
            </span>
          ) : null}
        </div>
      </PageHeaderShell>
    </WorkspaceHeader>
  );
}
