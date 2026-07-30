import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';

const checkEmailSearchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute('/check-email')({
  validateSearch: (search: Record<string, unknown>) => checkEmailSearchSchema.parse(search),
  component: CheckEmailPage,
});

function CheckEmailPage() {
  const { email } = Route.useSearch();
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            {email ? (
              <>
                We've sent a confirmation link to <span className="text-foreground">{email}</span>.
                Open it to activate your account and finish signing in.
              </>
            ) : (
              <>
                We've sent you a confirmation link. Open it to activate your account and finish
                signing in.
              </>
            )}
          </p>
          <Button
            variant="outline"
            render={
              <Link to="/login" search={{ returnTo: undefined }}>
                Back to log in
              </Link>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
