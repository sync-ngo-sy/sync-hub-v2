import { DeadLinkScreen as SharedDeadLinkScreen } from '@sync/ui/components/auth-screen';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link, type LinkProps } from '@tanstack/react-router';
import { PublicHeader } from '@/features/shell/components/public-header';

interface DeadLinkScreenProps {
  description: string;
  action: { to: LinkProps['to']; label: string };
}

export function DeadLinkScreen({ description, action }: DeadLinkScreenProps) {
  return (
    <SharedDeadLinkScreen
      header={<PublicHeader />}
      description={description}
      action={
        <Link to={action.to} className={buttonVariants({ variant: 'outline' })}>
          {action.label}
        </Link>
      }
    />
  );
}
