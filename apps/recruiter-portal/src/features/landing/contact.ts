export const CONTACT_SUBJECT = 'Sync for our company';

export function whatsAppHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(CONTACT_SUBJECT)}`;
}

export function emailHref(address: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(CONTACT_SUBJECT)}`;
}
