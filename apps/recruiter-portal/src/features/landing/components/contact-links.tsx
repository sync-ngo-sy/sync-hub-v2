import { cn } from '@sync/ui/lib/utils';
import { Mail, MessageCircle } from 'lucide-react';
import { env } from '@/lib/env';
import { emailHref, whatsAppHref } from '../contact';

const LINK =
  'flex items-center gap-2.5 text-dense font-medium text-foreground hover:text-accent-foreground';

export function ContactLinks({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <a
        href={whatsAppHref(env.contact.whatsapp)}
        target="_blank"
        rel="noreferrer"
        className={LINK}
      >
        <MessageCircle className="size-4.5 shrink-0 text-primary" />
        WhatsApp <span className="font-normal text-muted-foreground">{env.contact.whatsapp}</span>
      </a>
      <a href={emailHref(env.contact.email)} className={LINK}>
        <Mail className="size-4.5 shrink-0 text-primary" />
        Email <span className="font-normal text-muted-foreground">{env.contact.email}</span>
      </a>
    </div>
  );
}
