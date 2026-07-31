export const CV_CAP = 5;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const;

export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const FILE_ACCEPT_ATTR = [...ACCEPTED_MIME_TYPES, ...ACCEPTED_EXTENSIONS].join(',');

export const ACCEPTED_LABEL = 'PDF, DOC or DOCX';

export const MAX_FILE_LABEL = '10 MB';
