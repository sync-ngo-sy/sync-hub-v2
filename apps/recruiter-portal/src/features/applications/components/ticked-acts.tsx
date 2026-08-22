import { Button } from '@sync/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { actDestination, actLabel, LADDER_ACTS, type TickedAct, tickedLabel } from '../ending';

interface TickedActsProps {
  ticked: number;
  acts: TickedAct[];
  onAct: (act: TickedAct) => void;
  onClear: () => void;
}

export function TickedActs({ ticked, acts, onAct, onClear }: TickedActsProps) {
  const ladder = LADDER_ACTS.filter((act) => acts.includes(act));

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-border bg-card px-(--space-card) py-3 shadow-card">
      <p role="status" className="text-dense text-foreground">
        {tickedLabel(ticked)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onClear}>
          Clear ticks
        </Button>

        {ladder.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Move to
              <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {ladder.map((act) => (
                <DropdownMenuItem key={act} onClick={() => onAct(act)}>
                  {actDestination(act)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {acts.includes('reopen') ? (
          <Button onClick={() => onAct('reopen')}>{actLabel('reopen', ticked)}</Button>
        ) : null}

        {acts.includes('end') ? (
          <Button variant="destructive" onClick={() => onAct('end')}>
            {actLabel('end', ticked)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
