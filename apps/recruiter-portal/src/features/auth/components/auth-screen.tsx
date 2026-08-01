import { AUTH_LINK, AuthScreen as SharedAuthScreen } from '@sync/ui/components/auth-screen';
import type { ComponentProps } from 'react';
import { PublicHeader } from '@/features/shell/components/public-header';

export { AUTH_LINK };

export function AuthScreen(props: Omit<ComponentProps<typeof SharedAuthScreen>, 'header'>) {
  return <SharedAuthScreen {...props} header={<PublicHeader />} />;
}
