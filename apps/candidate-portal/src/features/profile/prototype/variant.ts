// PROTOTYPE for #369 — throwaway. What every variant is handed, and the one thing they share.

import type { FormEventHandler, ReactNode } from 'react';
import type { UpdateStub } from './use-update-stub';

export interface VariantProps {
  update: UpdateStub;
  cvs: (offer?: ReactNode) => ReactNode;
  card: ReactNode;
  fields: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  isDirty: boolean;
  isSubmitting: boolean;
}

// The real bar sits at `bottom-20 md:bottom-4`. It is lifted here so the prototype's own bar does
// not cover the thing being judged; the offset is nobody's design decision.
export const SAVE_BAR =
  'sticky bottom-28 z-10 flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3';
