import { Link } from '@tanstack/react-router';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';

/** Chrome for the routes that have no sidebar: the landing page and the auth screens. */
export function PublicHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border px-5 py-3 lg:px-8">
      <Link to="/" aria-label="Sync home">
        <Brand />
      </Link>
      <ThemeToggle />
    </header>
  );
}
