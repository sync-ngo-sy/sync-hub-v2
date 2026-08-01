import {
  SentTo,
  CheckEmailScreen as SharedCheckEmailScreen,
} from '@sync/ui/components/auth-screen';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { PublicHeader } from '@/features/shell/components/public-header';

export { SentTo };

export function CheckEmailScreen({ children }: { children: ReactNode }) {
  return (
    <SharedCheckEmailScreen
      header={<PublicHeader />}
      backAction={
        <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
          Back to sign in
        </Link>
      }
    >
      {children}
    </SharedCheckEmailScreen>
  );
}
