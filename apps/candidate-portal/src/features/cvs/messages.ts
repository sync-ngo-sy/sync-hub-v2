import { errorStatus } from '../../lib/errors';
import { ACCEPTED_LABEL, CV_CAP, MAX_FILE_LABEL } from './constants';

function isDuplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'cv_id' in error &&
    (error as { cv_id?: unknown }).cv_id != null
  );
}

export function uploadErrorMessage(error: unknown): string {
  switch (errorStatus(error)) {
    case 409:
      return isDuplicate(error)
        ? "You've already uploaded this file — it's one of your CVs."
        : `You already keep the maximum of ${CV_CAP} CVs. Delete one to add another.`;
    case 413:
      return `That file is larger than ${MAX_FILE_LABEL}. Choose a smaller one.`;
    case 415:
      return `That file is not a ${ACCEPTED_LABEL}. Choose a supported document.`;
    case 502:
      return "The file store couldn't be reached. Try again in a moment.";
    default:
      return "That upload didn't go through. Try again.";
  }
}

export function deleteErrorMessage(error: unknown): string {
  return errorStatus(error) === 409
    ? 'This is your Current CV. Make another CV current first, then delete this one.'
    : "That CV couldn't be deleted. Try again.";
}
