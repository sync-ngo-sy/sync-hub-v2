import { z } from 'zod';

// Password floor mirrors the API's own minimum (`Password`, min 8) so a too-short password is
// caught in-form rather than bounced back as a 400.
export const signUpSchema = z.object({
  full_name: z.string().min(1, 'Enter your name'),
  email: z.string().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
