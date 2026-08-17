import { fileRules } from '@sync/ui/lib/file-check';

export const LOGO_FORMATS = 'JPEG, PNG or WebP';

const LOGO_RULES = fileRules({
  mediaTypeByExtension: {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  },
  wrongType: `A logo has to be a ${LOGO_FORMATS} image.`,
  empty: 'That file is empty.',
});

export const LOGO_FILE_ACCEPT = LOGO_RULES.accept;
export const rejectionFor = LOGO_RULES.rejectionFor;
