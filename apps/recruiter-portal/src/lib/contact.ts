import { z } from 'zod';

// Dev and tests fall back to these so a fresh checkout runs; a production build must carry a real
// contact, enforced in `readContact` — so a live page never points at a placeholder no one owns.
const PLACEHOLDER_WHATSAPP = '963991234567';
const PLACEHOLDER_EMAIL = 'hello@sync.ngo';

const contactSchema = z.object({
  VITE_CONTACT_WHATSAPP: z
    .string()
    // Accept a human-typed number ("+963 991 234 567") and reduce it to the digits `wa.me` wants.
    .transform((value) => value.replace(/[^\d]/g, ''))
    .refine(
      (digits) => /^[1-9]\d{6,14}$/.test(digits),
      'must be an international number, no leading 0',
    ),
  VITE_CONTACT_EMAIL: z.string().email('must be a valid email address'),
});

// What a recruiter reaching out already knows: they want to set up a workspace. Prefilling it saves
// them the opener and tells the Sync team which surface the message came from.
const WHATSAPP_MESSAGE = 'Hi Sync — I would like to set up a workspace for my company.';

export interface Contact {
  /** International digits only, as `wa.me` expects them. */
  whatsappNumber: string;
  /** `wa.me` deep link, with the opener prefilled. */
  whatsappUrl: string;
  email: string;
  /** `mailto:` link for the email. */
  emailUrl: string;
}

function present(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export function readContact(source: Record<string, unknown>, prod = false): Contact {
  const whatsapp = present(source.VITE_CONTACT_WHATSAPP);
  const email = present(source.VITE_CONTACT_EMAIL);
  if (prod && (whatsapp === undefined || email === undefined)) {
    throw new Error(
      '[recruiter-portal] VITE_CONTACT_WHATSAPP and VITE_CONTACT_EMAIL must be set in a production build',
    );
  }

  const result = contactSchema.safeParse({
    VITE_CONTACT_WHATSAPP: whatsapp ?? PLACEHOLDER_WHATSAPP,
    VITE_CONTACT_EMAIL: email ?? PLACEHOLDER_EMAIL,
  });
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'contact'}: ${issue.message}`)
      .join('; ');
    throw new Error(`[recruiter-portal] Invalid contact environment — ${detail}`);
  }

  const { VITE_CONTACT_WHATSAPP: whatsappNumber, VITE_CONTACT_EMAIL: address } = result.data;
  return {
    whatsappNumber,
    whatsappUrl: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`,
    email: address,
    emailUrl: `mailto:${address}`,
  };
}

export const contact = readContact(import.meta.env, import.meta.env.PROD === true);
