import { Button } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { bounceIfAuthed } from '../lib/auth';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    await bounceIfAuthed(context.queryClient);
  },
  component: LandingPage,
});

// The Editorial landing (typewriter hero, jobs index) is its own ticket; this is the shell's
// placeholder public route — the logout/redirect target the auth guard needs to exist.
function LandingPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-h1 font-heading text-foreground">
        Syria's jobs, in one <span className="text-accent-foreground">clear</span> place.
      </h1>
      <p className="max-w-md text-muted-foreground">
        Sync connects candidates across Syria with employers hiring today.
      </p>
      <Button
        size="lg"
        render={
          <Link to="/login" search={{ returnTo: undefined }}>
            Log in
          </Link>
        }
      />
    </div>
  );
}
