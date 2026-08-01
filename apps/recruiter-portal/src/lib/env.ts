import { readClientEnv } from '@sync/api-client';
import { z } from 'zod';

/**
 * One global contact for the whole platform — the landing offers it to every visitor, so it is
 * configured rather than derived, and never carries a Tenant's own details.
 */
const contactSchema = z.object({
  VITE_CONTACT_WHATSAPP: z.string().regex(/^\+[1-9]\d{6,14}$/, {
    error: 'VITE_CONTACT_WHATSAPP must be a phone number in E.164 form, e.g. +963944123456',
  }),
  VITE_CONTACT_EMAIL: z.email({ error: 'VITE_CONTACT_EMAIL must be an email address' }),
});

function readContact(source: Record<string, unknown>): { whatsapp: string; email: string } {
  const result = contactSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid contact environment — ${result.error.issues.map((issue) => issue.message).join('; ')}. See .env.example.`,
    );
  }
  return { whatsapp: result.data.VITE_CONTACT_WHATSAPP, email: result.data.VITE_CONTACT_EMAIL };
}

/**
 * An unset base URL means same-origin, which is the topology in dev (behind the Vite
 * proxy) and in production (portals served same-site with the API).
 */
export const env = {
  ...readClientEnv({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
  }),
  contact: readContact({
    VITE_CONTACT_WHATSAPP: import.meta.env.VITE_CONTACT_WHATSAPP,
    VITE_CONTACT_EMAIL: import.meta.env.VITE_CONTACT_EMAIL,
  }),
};
