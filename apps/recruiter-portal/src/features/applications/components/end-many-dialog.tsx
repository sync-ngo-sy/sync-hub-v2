import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { Label } from '@sync/ui/components/ui/label';
import { CircleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { problemDetail } from '@/lib/api-problem';
import type { PipelineStatus } from '../application';
import {
  endableStatuses,
  endingTotalMessage,
  endLabel,
  endsWhatItTicked,
  type SweptApplications,
} from '../ending';

const WHAT_A_SWEEP_COSTS =
  'Everything you tick is rejected together, and nothing else on this Job is touched. The ' +
  'people it ends hear three days from now — until then nothing has reached them, and moving ' +
  'one back to Reviewing inside those three days cancels it.';

const INHERITED =
  'The filters on your list still apply. Only the Pipeline tab is replaced by what you tick here.';

const REFUSED = "These Applications couldn't be ended.";

interface EndManyDialogProps {
  counts: Partial<Record<PipelineStatus, number>>;
  narrowed: boolean;
  onConfirm: (statuses: PipelineStatus[]) => Promise<SweptApplications>;
  onClose: () => void;
}

export function EndManyDialog({ counts, narrowed, onConfirm, onClose }: EndManyDialogProps) {
  const boxes = useId();
  const [ticked, setTicked] = useState<PipelineStatus[]>([]);
  const [ending, setEnding] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const statuses = endableStatuses(counts);
  const total = endsWhatItTicked(ticked, counts);

  function changeOpen(open: boolean) {
    if (open || ending) return;
    onClose();
  }

  function tick(status: PipelineStatus, on: boolean) {
    setTicked((chosen) => (on ? [...chosen, status] : chosen.filter((each) => each !== status)));
  }

  async function confirm() {
    if (ending || total === 0) return;
    setRefusal(null);
    setEnding(true);
    try {
      await onConfirm(ticked);
    } catch (error) {
      setRefusal(problemDetail(error, REFUSED));
      setEnding(false);
    }
  }

  return (
    <Dialog open onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>End many Applications</DialogTitle>
          <DialogDescription>{WHAT_A_SWEEP_COSTS}</DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3 py-2">
          <legend className="sr-only">The statuses to end</legend>
          {statuses.map(({ status, label, count }) => (
            <div key={status} className="flex items-center gap-3">
              <Checkbox
                id={`${boxes}-${status}`}
                disabled={count === 0 || ending}
                checked={ticked.includes(status)}
                onCheckedChange={(on) => tick(status, on)}
              />
              <Label
                htmlFor={`${boxes}-${status}`}
                className="flex flex-1 items-center justify-between gap-4"
              >
                {label}{' '}
                <span className="font-mono tabular-nums text-muted-foreground">{count}</span>
              </Label>
            </div>
          ))}
        </fieldset>

        <p role="status" className="text-dense text-foreground">
          {endingTotalMessage(total)}
        </p>

        {narrowed ? <p className="text-meta text-muted-foreground">{INHERITED}</p> : null}

        {refusal ? (
          <Alert className="mt-2">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Nothing ended</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={ending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={ending || total === 0}
            onClick={() => void confirm()}
          >
            {ending ? 'Ending…' : endLabel(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
