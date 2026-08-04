import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { DashboardPanel } from './dashboard-panel';

interface TrendSlotProps {
  title: string;
  description: string;
  icon: LucideIcon;
  coming: string;
  action?: ReactNode;
}

export function TrendSlot({ title, description, icon: Icon, coming, action }: TrendSlotProps) {
  return (
    <DashboardPanel title={title} description={description}>
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border px-5 py-6">
        <span className="flex items-center gap-2 text-meta font-medium text-muted-foreground">
          <Icon aria-hidden="true" className="size-4" />
          Chart pending
        </span>
        <p className="max-w-prose text-dense text-muted-foreground">{coming}</p>
        {action}
      </div>
    </DashboardPanel>
  );
}
