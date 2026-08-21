import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { ResetPasswordScreen, ScreenSkeleton } from '@/features/auth/components';

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: z.object({ token_hash: z.string().optional() }),
  pendingComponent: () => <ScreenSkeleton fields={1} />,
  component: () => {
    const navigate = useNavigate();
    return (
      <ResetPasswordScreen
        tokenHash={Route.useSearch().token_hash}
        onReset={() => {
          void navigate({ to: '/login' });
        }}
      />
    );
  },
});
