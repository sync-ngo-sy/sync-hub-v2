import { Button } from '@sync/ui/components/ui/button';

export function AppShellErrorFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <p className="font-heading text-lg font-medium">Something went wrong</p>
      <p className="text-sm text-muted-foreground">Reloading the page usually fixes this.</p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  );
}
