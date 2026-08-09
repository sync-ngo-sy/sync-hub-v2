import { cn } from '@sync/ui/lib/utils';
import { CheckIcon } from 'lucide-react';
import { PASSWORD_RULES } from '../password-rules';

function Marker({ met }: { met: boolean }) {
  return (
    <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center">
      {met ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <span className="size-2 rounded-full border border-current" />
      )}
    </span>
  );
}

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul aria-label="Password requirements" className="space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.holds(password);
        return (
          <li
            key={rule.name}
            data-met={met ? 'true' : 'false'}
            className={cn(
              'flex items-center gap-2 text-dense transition-colors',
              met ? 'text-accent-foreground' : 'text-muted-foreground',
            )}
          >
            <Marker met={met} />
            <span>{rule.requirement}</span>
            <span className="sr-only">{met ? '— met' : '— not met yet'}</span>
          </li>
        );
      })}
    </ul>
  );
}
