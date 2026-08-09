import { Tabs } from '@sync/ui/components/ui/tabs';
import { LineTabsList } from '@/features/shell/components/line-tabs-list';
import { PIPELINE_STATUSES, type PipelineStatus, pipelineState } from '../application';

interface ApplicationPipelineTabsProps {
  pipeline?: PipelineStatus[];
  counts: Partial<Record<PipelineStatus, number>>;
  onChange: (pipeline?: PipelineStatus[]) => void;
  className?: string;
}

export function ApplicationPipelineTabs({
  pipeline,
  counts,
  onChange,
  className,
}: ApplicationPipelineTabsProps) {
  const selected = pipeline?.length === 1 && pipeline[0] ? pipeline[0] : 'all';
  const total = PIPELINE_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const tabs = [
    { value: 'all', label: 'All', count: total },
    ...PIPELINE_STATUSES.map((status) => ({
      value: status,
      label: pipelineState(status).label,
      count: counts[status] ?? 0,
    })),
  ];

  return (
    <Tabs
      className="min-w-full gap-0"
      value={selected}
      onValueChange={(value) => onChange(value === 'all' ? undefined : [value as PipelineStatus])}
    >
      <LineTabsList label="Pipeline" value={selected} tabs={tabs} className={className} />
    </Tabs>
  );
}
