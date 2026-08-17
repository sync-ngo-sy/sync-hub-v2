import { fileRules } from '@sync/ui/lib/file-check';

export const MAX_CV_BYTES = 10 * 1024 * 1024;

const MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const CV_FORMATS = 'PDF, DOC or DOCX';

export const MAX_CV_MB = MAX_CV_BYTES / (1024 * 1024);

const CV_RULES = fileRules({
  mediaTypeByExtension: MEDIA_TYPE_BY_EXTENSION,
  maxBytes: MAX_CV_BYTES,
  wrongType: `A CV has to be a ${CV_FORMATS} file.`,
  empty: 'That file is empty.',
  tooLarge: `That file is larger than ${MAX_CV_MB} MB. Try a smaller one.`,
});

export const CV_FILE_ACCEPT = CV_RULES.accept;
export const rejectionFor = CV_RULES.rejectionFor;
