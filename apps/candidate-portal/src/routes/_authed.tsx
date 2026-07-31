import { cn } from '@sync/ui/lib/utils';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { requireCandidate } from '../lib/auth';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const profile = await requireCandidate(context.queryClient, location.href);
    return { profile };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: '/applications', label: 'Applications' },
  { to: '/cvs', label: 'CVs' },
] as const;

function AuthedLayout() {
  return (
    <div className="flex flex-1 flex-col">
      <nav aria-label="Your account" className="border-b border-border bg-background px-4">
        <ul className="mx-auto flex w-full max-w-3xl gap-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  'inline-flex h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground hover:text-foreground',
                )}
                activeProps={{ className: 'border-primary text-foreground' }}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
