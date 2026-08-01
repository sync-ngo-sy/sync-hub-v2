import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link, type LinkProps } from '@tanstack/react-router';
import { AuthScreen } from './auth-screen';

interface DeadLinkScreenProps {
  description: string;
  action: { to: LinkProps['to']; label: string };
}

export function DeadLinkScreen({ description, action }: DeadLinkScreenProps) {
  return (
    <AuthScreen title="This link didn't work" description={description}>
      <div>
        <Link to={action.to} className={buttonVariants({ variant: 'outline' })}>
          {action.label}
        </Link>
      </div>
    </AuthScreen>
  );
}
