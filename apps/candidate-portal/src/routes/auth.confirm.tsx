import { Button } from '@sync/ui/components/ui/button';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { establishSession } from '../lib/auth';

const confirmSearchSchema = z.object({
  token_hash: z.string().optional(),
  // GoTrue appends `&type=signup`; accept it so it doesn't fail validation, but we don't use it.
  type: z.string().optional(),
});

export const Route = createFileRoute('/auth/confirm')({
  validateSearch: (search: Record<string, unknown>) => confirmSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ tokenHash: search.token_hash }),
  // Redeem the token as the route loads: on success we already hold a session, so seed it and
  // redirect to the authed home. Only a missing or rejected token falls through to the component.
  loader: async ({ context, deps }) => {
    if (!deps.tokenHash) return;
    const { data, error } = await context.client.POST('/v1/auth/confirm-email', {
      body: { token_hash: deps.tokenHash },
    });
    if (error || !data) return;
    establishSession(context.queryClient, data);
    toast.success('Your email is confirmed. Welcome to Sync.');
    throw redirect({ to: '/applications' });
  },
  component: ConfirmEmailPage,
});

function ConfirmEmailPage() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-h2 font-heading text-foreground">This link didn't work</h1>
      <p className="text-muted-foreground">
        Your confirmation link is invalid or has expired. Log in to try again, or create a new
        account.
      </p>
      <div className="flex gap-3">
        <Button
          render={
            <Link to="/login" search={{ returnTo: undefined }}>
              Back to log in
            </Link>
          }
        />
        <Button variant="outline" render={<Link to="/signup">Create an account</Link>} />
      </div>
    </div>
  );
}
