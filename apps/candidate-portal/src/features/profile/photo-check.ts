export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const MEDIA_TYPES = [...new Set(Object.values(MEDIA_TYPE_BY_EXTENSION))];

export const PHOTO_FILE_ACCEPT = [...Object.keys(MEDIA_TYPE_BY_EXTENSION), ...MEDIA_TYPES].join(
  ',',
);

export const PHOTO_FORMATS = 'JPEG, PNG or WebP';

export const MAX_PHOTO_MB = MAX_PHOTO_BYTES / (1024 * 1024);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

export function rejectionFor(file: File): string | null {
  const declared = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  const accepted =
    MEDIA_TYPES.includes(declared) || extensionOf(file.name) in MEDIA_TYPE_BY_EXTENSION;
  if (!accepted) return `A profile photo has to be a ${PHOTO_FORMATS} image.`;
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_PHOTO_BYTES)
    return `That photo is larger than ${MAX_PHOTO_MB} MB. Try a smaller one.`;
  return null;
}
