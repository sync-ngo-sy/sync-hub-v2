import { fileRules } from '@sync/ui/lib/file-check';

const MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const PHOTO_FORMATS = 'JPEG, PNG or WebP';

const PHOTO_RULES = fileRules({
  mediaTypeByExtension: MEDIA_TYPE_BY_EXTENSION,
  wrongType: `A profile photo has to be a ${PHOTO_FORMATS} image.`,
  empty: 'That file is empty.',
});

export const PHOTO_FILE_ACCEPT = PHOTO_RULES.accept;
export const rejectionFor = PHOTO_RULES.rejectionFor;
