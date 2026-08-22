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
    <div className="space-y-3 rounded-md border-2 border-accent-foreground/30 p-3">
      <p role="status" className="text-dense text-foreground">
        {tickedLabel(ticked)}
      </p>

      <div className="flex flex-col gap-2">
        {ladder.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              Move ticked to
              <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {ladder.map((act) => (
                <DropdownMenuItem key={act} onClick={() => onAct(act)}>
                  {actDestination(act)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {acts.includes('reopen') ? (
          <Button size="sm" onClick={() => onAct('reopen')}>
            {actLabel('reopen', ticked)}
          </Button>
        ) : null}

        {acts.includes('end') ? (
          <Button variant="destructive" size="sm" onClick={() => onAct('end')}>
            {actLabel('end', ticked)}
          </Button>
        ) : null}

        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear ticks
        </Button>
      </div>
    </div>
  );
}
