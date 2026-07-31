import type { ReactNode } from 'react';

export function CenteredScreen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 text-center">
      {children}
    </div>
  );
}
