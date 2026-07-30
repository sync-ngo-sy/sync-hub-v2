import { Button } from '@sync/ui/components/ui/button';

export function App() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Sync Platform</p>
        <h1 className="text-4xl font-bold tracking-tight">Candidate Portal</h1>
        <p className="text-muted-foreground max-w-md">
          React 19 + Vite + Tailwind v4, sharing <code>@sync/ui</code> with the recruiter portal.
        </p>
      </div>
      <div className="flex gap-3">
        <Button>Get started</Button>
        <Button variant="outline">Learn more</Button>
      </div>
    </main>
  );
}
