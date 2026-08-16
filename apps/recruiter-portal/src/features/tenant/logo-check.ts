import { fileRules } from '@sync/ui/lib/file-check';

export const LOGO_FORMATS = 'JPEG, PNG or WebP';

export const MAX_LOGO_MB = 5;

const LOGO_RULES = fileRules({
  mediaTypeByExtension: {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  },
  wrongType: `A logo has to be a ${LOGO_FORMATS} image.`,
  empty: 'That file is empty.',
  maxBytes: MAX_LOGO_MB * 1024 * 1024,
  tooLarge: `A logo has to be ${MAX_LOGO_MB} MB or smaller.`,
});

export const LOGO_FILE_ACCEPT = LOGO_RULES.accept;
export const rejectionFor = LOGO_RULES.rejectionFor;
