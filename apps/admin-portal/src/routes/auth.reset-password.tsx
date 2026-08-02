import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { ResetPasswordScreen } from '@/features/auth/components';

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: z.object({ token_hash: z.string().optional() }),
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
