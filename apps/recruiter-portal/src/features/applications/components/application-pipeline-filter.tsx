import { ChipFilter } from '@sync/ui/components/chip-filter';
import {
  PIPELINE_TABS,
  type PipelineTab,
  pipelineTabCount,
  pipelineTabLabel,
  type StatusCounts,
} from '../application';

interface ApplicationPipelineFilterProps {
  pipeline: PipelineTab;
  counts: StatusCounts;
  onChange: (pipeline: PipelineTab) => void;
  className?: string;
}

export function ApplicationPipelineFilter({
  pipeline,
  counts,
  onChange,
  className,
}: ApplicationPipelineFilterProps) {
  const chips = PIPELINE_TABS.map((tab) => ({
    value: tab,
    label: pipelineTabLabel(tab),
    count: pipelineTabCount(tab, counts),
  }));

  return (
    <ChipFilter
      label="Pipeline"
      value={pipeline}
      chips={chips}
      className={className}
      onValueChange={(chosen) => onChange(chosen as PipelineTab)}
    />
  );
}
