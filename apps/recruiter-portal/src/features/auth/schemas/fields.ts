import { z } from 'zod';

export const email = z
  .string()
  .min(1, 'Enter your email.')
  .pipe(z.email('Enter a valid email address.'));

export const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.');
