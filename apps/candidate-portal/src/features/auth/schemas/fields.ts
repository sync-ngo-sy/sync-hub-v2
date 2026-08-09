import { z } from 'zod';
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from '../password-rules';

export const email = z
  .string()
  .min(1, 'Enter your email.')
  .pipe(z.email('Enter a valid email address.'));

export const newPassword = z
  .string()
  .min(MINIMUM_PASSWORD_LENGTH, 'Use at least 8 characters.')
  .max(MAXIMUM_PASSWORD_LENGTH, 'Use 72 characters or fewer.')
  .regex(/[A-Z]/, 'Add an uppercase letter.')
  .regex(/[a-z]/, 'Add a lowercase letter.')
  .regex(/[0-9]/, 'Add a digit.');
