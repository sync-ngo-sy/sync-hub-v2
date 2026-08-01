import { cn } from '@sync/ui/lib/utils';
import { Mail, MessageCircle } from 'lucide-react';
import { env } from '@/lib/env';
import { contactChannels } from '../contact';

const CHANNELS = contactChannels(env.contact);

export const hasContact = Boolean(CHANNELS.whatsapp || CHANNELS.email);

const LINK =
  'flex items-center gap-2.5 text-dense font-medium text-foreground hover:text-accent-foreground';

const VALUE = 'font-normal text-muted-foreground';

export function ContactLinks({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {CHANNELS.whatsapp ? (
        <a href={CHANNELS.whatsapp.href} target="_blank" rel="noreferrer" className={LINK}>
          <MessageCircle className="size-4.5 shrink-0 text-primary" />
          WhatsApp <span className={VALUE}>{CHANNELS.whatsapp.label}</span>
        </a>
      ) : null}
      {CHANNELS.email ? (
        <a href={CHANNELS.email.href} className={LINK}>
          <Mail className="size-4.5 shrink-0 text-primary" />
          Email <span className={VALUE}>{CHANNELS.email.label}</span>
        </a>
      ) : null}
    </div>
  );
}
