import { z } from 'zod';

export const CONTACT_SUBJECT = 'Sync Hub for our company';

const numberSchema = z.string().regex(/^\+[1-9][\d\s-]{6,18}$/);

const addressSchema = z.email();

export interface Channel {
  href: string;
  label: string;
}

export interface ContactChannels {
  whatsapp: Channel | null;
  email: Channel | null;
}

export function whatsAppHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(CONTACT_SUBJECT)}`;
}

export function emailHref(address: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(CONTACT_SUBJECT)}`;
}

export function contactChannels(configured: { whatsapp: string; email: string }): ContactChannels {
  const phone = numberSchema.safeParse(configured.whatsapp.trim());
  const address = addressSchema.safeParse(configured.email.trim());

  return {
    whatsapp: phone.success ? { href: whatsAppHref(phone.data), label: phone.data } : null,
    email: address.success ? { href: emailHref(address.data), label: address.data } : null,
  };
}
