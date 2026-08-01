export const MAX_CV_BYTES = 10 * 1024 * 1024;

const MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const MEDIA_TYPES = Object.values(MEDIA_TYPE_BY_EXTENSION);

/** What the file picker offers, so the reader meets the constraint before they choose. */
export const CV_FILE_ACCEPT = [...Object.keys(MEDIA_TYPE_BY_EXTENSION), ...MEDIA_TYPES].join(',');

export const CV_FORMATS = 'PDF, DOC or DOCX';

export const MAX_CV_MB = MAX_CV_BYTES / (1024 * 1024);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

/**
 * The same three rules the API applies, so a file that would bounce never costs an upload —
 * declared type first, extension second, exactly as `_media_type_of` does server-side.
 */
export function rejectionFor(file: File): string | null {
  const declared = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  const accepted =
    MEDIA_TYPES.includes(declared) || extensionOf(file.name) in MEDIA_TYPE_BY_EXTENSION;
  if (!accepted) return `A CV has to be a ${CV_FORMATS} file.`;
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_CV_BYTES)
    return `That file is larger than ${MAX_CV_MB} MB. Try a smaller one.`;
  return null;
}
