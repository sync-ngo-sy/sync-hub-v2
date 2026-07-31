import { Mail, MessageCircle } from 'lucide-react';
import { contact } from '@/lib/contact';
import { WRAP } from '../wrap';

const CONTACT_LINK =
  'inline-flex items-center gap-2.5 rounded-md border border-border bg-card px-4 py-3 text-[15px] font-medium text-foreground hover:border-accent-foreground';

export function ContactBand() {
  return (
    <section id="contact" className="py-[clamp(3.5rem,8vw,6rem)]">
      <div className={WRAP}>
        <div className="max-w-[52ch]">
          <p className="mb-3 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Talk to us
          </p>
          <h2 className="mb-4 text-h2 font-heading font-medium text-foreground">
            Not sure Sync fits how you hire? Ask us.
          </h2>
          <p className="mb-8 text-[15px] text-secondary-foreground">
            The Sync team helps you set up your workspace and your first roles. Reach us on WhatsApp
            or by email — whichever you prefer.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={contact.whatsappUrl} target="_blank" rel="noreferrer" className={CONTACT_LINK}>
            <MessageCircle aria-hidden className="size-4 text-accent-foreground" />
            Message us on WhatsApp
          </a>
          <a href={contact.emailUrl} className={CONTACT_LINK}>
            <Mail aria-hidden className="size-4 text-accent-foreground" />
            {contact.email}
          </a>
        </div>
      </div>
    </section>
  );
}
