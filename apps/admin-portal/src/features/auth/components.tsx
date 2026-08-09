import { PasswordInput } from '@sync/ui/components/password-input';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { Link } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useState } from 'react';
import { problemMessage } from '@/lib/api-problem';
import type { Profile } from './current-profile';
import { useLogIn, useLogOut, useRequestPasswordReset, useResetPassword } from './hooks';
import { PASSWORD_POLICY_SUMMARY } from './password-rules';

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-5">
      <h1 className="font-heading text-h3 text-foreground">{title}</h1>
      {children}
    </main>
  );
}

export function LoginForm({ onSignedIn }: { onSignedIn: (profile: Profile) => void }) {
  const logIn = useLogIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      onSignedIn(await logIn.mutateAsync({ body: { email, password } }));
    } catch (reason) {
      setError(problemMessage(reason, "Couldn't sign you in. Try again."));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={logIn.isPending}>
        {logIn.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
      <Link to="/forgot-password" className="block text-center text-sm underline">
        Forgot your password?
      </Link>
    </form>
  );
}

export function SignInScreen({ onSignedIn }: { onSignedIn: (profile: Profile) => void }) {
  return (
    <Screen title="Sign in">
      <p className="text-muted-foreground">Operate the Sync Hub platform.</p>
      <LoginForm onSignedIn={onSignedIn} />
    </Screen>
  );
}

export function ForgotPasswordScreen() {
  const request = useRequestPasswordReset();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sent)
    return (
      <Screen title="Check your email">
        <p>If an account exists for {email}, a password-reset link is on its way.</p>
      </Screen>
    );
  return (
    <Screen title="Reset your password">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await request.mutateAsync({ body: { email } });
            setSent(true);
          } catch (reason) {
            setError(problemMessage(reason, "Couldn't send the email. Try again."));
          }
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full">
          Send reset link
        </Button>
      </form>
    </Screen>
  );
}

export function ResetPasswordScreen({
  tokenHash,
  onReset,
}: {
  tokenHash?: string;
  onReset: () => void;
}) {
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!tokenHash)
    return (
      <Screen title="Reset link unavailable">
        <p>Ask for a new password-reset link.</p>
        <Link to="/forgot-password" className="underline">
          Send a new link
        </Link>
      </Screen>
    );
  return (
    <Screen title="Choose a new password">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await reset.mutateAsync({ body: { token_hash: tokenHash, password } });
            onReset();
          } catch (reason) {
            setError(problemMessage(reason, "Couldn't set your password. Try again."));
          }
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            aria-describedby="new-password-policy"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <p id="new-password-policy" className="text-dense text-muted-foreground">
            {PASSWORD_POLICY_SUMMARY}
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full">
          Save new password
        </Button>
      </form>
    </Screen>
  );
}

export function WrongPortalScreen({ accountType }: { accountType: Profile['account_type'] }) {
  const logOut = useLogOut();
  return (
    <Screen title="This is the Sync Hub Platform Portal">
      <p className="text-muted-foreground">
        You're signed in with a {accountType} account, which this portal does not serve.
      </p>
      <Button variant="outline" disabled={logOut.isPending} onClick={() => logOut.mutate({})}>
        Sign out
      </Button>
    </Screen>
  );
}
