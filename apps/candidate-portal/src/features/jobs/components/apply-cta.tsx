import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { PublicJobQuestion } from '@/features/applications/application';
import { ApplicationForm } from '@/features/applications/components/application-form';

const INLINE_LINK = 'font-medium text-accent-foreground underline underline-offset-4';

interface ApplyCtaProps {
  signedIn: boolean;
  returnTo: string;
  jobId: string;
  questions: PublicJobQuestion[];
}

export function ApplyCta({ signedIn, returnTo, jobId, questions }: ApplyCtaProps) {
  const [started, setStarted] = useState(false);
  const [applied, setApplied] = useState(false);

  if (signedIn) {
    if (applied) {
      return (
        <Alert className="max-w-xl">
          <AlertTitle>Application sent</AlertTitle>
          <AlertDescription>
            You can follow its progress in{' '}
            <Link to="/applications" className={INLINE_LINK}>
              View My Applications
            </Link>
            .
          </AlertDescription>
        </Alert>
      );
    }

    if (started) {
      return (
        <ApplicationForm
          jobId={jobId}
          questions={questions}
          onApplied={() => setApplied(true)}
          onCancel={() => setStarted(false)}
        />
      );
    }

    return (
      <Button size="lg" onClick={() => setStarted(true)}>
        Apply
      </Button>
    );
  }

  return (
    <div className="space-y-2.5">
      <Link to="/login" search={{ returnTo }} className={buttonVariants({ size: 'lg' })}>
        Sign in to apply
      </Link>
      <p className="text-meta text-muted-foreground">
        New to Sync Hub?{' '}
        <Link to="/signup" className={INLINE_LINK}>
          Create an account
        </Link>
        .
      </p>
    </div>
  );
}
