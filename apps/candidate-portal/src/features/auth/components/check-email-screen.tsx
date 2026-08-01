import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AuthScreen } from './auth-screen';

export function CheckEmailScreen({ children }: { children: ReactNode }) {
  return (
    <AuthScreen title="Check your email" description={children}>
      <div>
        <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
          Back to sign in
        </Link>
      </div>
    </AuthScreen>
  );
}

export function SentTo({ email }: { email: string }) {
  return <strong className="font-medium text-foreground">{email}</strong>;
}
