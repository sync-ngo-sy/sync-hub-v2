import { ChipFilter } from '@sync/ui/components/chip-filter';
import { PIPELINE_STATUSES, type PipelineStatus, pipelineState, pipelineTab } from '../application';

interface ApplicationPipelineFilterProps {
  pipeline?: PipelineStatus[];
  counts: Partial<Record<PipelineStatus, number>>;
  onChange: (pipeline?: PipelineStatus[]) => void;
  className?: string;
}

export function ApplicationPipelineFilter({
  pipeline,
  counts,
  onChange,
  className,
}: ApplicationPipelineFilterProps) {
  const selected = pipelineTab(pipeline)?.[0] ?? 'all';
  const total = PIPELINE_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const chips = [
    { value: 'all', label: 'All', count: total },
    ...PIPELINE_STATUSES.map((status) => ({
      value: status,
      label: pipelineState(status).label,
      count: counts[status] ?? 0,
    })),
  ];

  return (
    <ChipFilter
      label="Pipeline"
      value={selected}
      chips={chips}
      className={className}
      onValueChange={(chosen) =>
        onChange(chosen === 'all' ? undefined : [chosen as PipelineStatus])
      }
    />
  );
}
