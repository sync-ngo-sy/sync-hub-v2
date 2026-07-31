import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_LABEL,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
} from '../constants';

export function validateCvFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `That file is larger than ${MAX_FILE_LABEL}. Choose a smaller one.`;
  }
  const name = file.name.toLowerCase();
  const extensionOk = ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
  const mimeOk = (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  if (!extensionOk && !mimeOk) {
    return `That file is not a ${ACCEPTED_LABEL}. Choose a supported document.`;
  }
  return null;
}
