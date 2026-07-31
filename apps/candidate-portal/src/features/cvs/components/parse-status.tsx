import { StatusChip } from '@sync/ui/components/status-chip';
import type { Cv } from '../status';
import { PARSE_LABELS } from '../status';

export function ParseStatus({ cv }: { cv: Cv }) {
  const { label, chip } = PARSE_LABELS[cv.parsing_status];
  return (
    <div className="space-y-1">
      <StatusChip status={chip} />
      {cv.parsing_status === 'failed' ? (
        <p className="text-sm text-muted-foreground">
          {cv.parsing_error ?? "We couldn't read this file."} Upload another file to try again.
        </p>
      ) : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}
