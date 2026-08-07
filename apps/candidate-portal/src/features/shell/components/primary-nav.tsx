import { Link } from '@tanstack/react-router';
import { DESTINATIONS } from '@/features/shell/nav';

export function PrimaryNav() {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:static md:z-auto md:ml-2 md:flex md:border-t-0 md:bg-transparent md:pb-0"
    >
      {DESTINATIONS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeProps={{ 'aria-current': 'page' }}
          className="flex flex-col items-center gap-1 py-2.5 text-meta text-muted-foreground aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground md:flex-row md:gap-2 md:rounded-lg md:px-3 md:py-2 md:text-dense md:hover:bg-accent/60 md:aria-[current=page]:bg-accent"
        >
          <Icon className="size-5 shrink-0 md:size-4.5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
