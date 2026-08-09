import { microLabel } from '@sync/ui/lib/micro-label';
import { cn } from '@sync/ui/lib/utils';
import { CheckIcon } from 'lucide-react';
import { PASSWORD_RULES } from '../password-rules';

function Marker({ met }: { met: boolean }) {
  return (
    <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center">
      {met ? (
        <CheckIcon className="size-3.5" strokeWidth={2.5} />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-50" />
      )}
    </span>
  );
}

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <div className="space-y-2">
      <p className={cn(microLabel, 'text-muted-foreground')}>Your password needs</p>
      <ul
        aria-label="Password requirements"
        className="grid grid-cols-2 gap-x-4 gap-y-1.5 lg:grid-cols-1"
      >
        {PASSWORD_RULES.map((rule) => {
          const met = rule.holds(password);
          return (
            <li
              key={rule.name}
              data-met={met ? 'true' : 'false'}
              className={cn(
                'flex items-center gap-2 text-dense transition-colors duration-150',
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
    </div>
  );
}
