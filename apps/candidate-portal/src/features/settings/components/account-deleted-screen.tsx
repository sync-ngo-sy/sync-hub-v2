import { CenteredScreen } from '@/features/shell/components/centered-screen';

export function AccountDeletedScreen() {
  return (
    <CenteredScreen>
      <h1 className="font-heading text-h3 text-foreground">Your account has been deleted</h1>
      <p className="text-muted-foreground">
        Thanks for being part of Sync. You are signed out, and we wish you all the best for what
        comes next.
      </p>
    </CenteredScreen>
  );
}
