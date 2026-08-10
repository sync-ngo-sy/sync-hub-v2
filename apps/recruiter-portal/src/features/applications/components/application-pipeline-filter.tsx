import { PIPELINE_STATUSES, type PipelineStatus, pipelineState } from '../application';
import { ChipFilter } from './chip-filter';

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
  const selected = pipeline?.length === 1 && pipeline[0] ? pipeline[0] : 'all';
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
