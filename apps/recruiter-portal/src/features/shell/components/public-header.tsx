import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';

export function PublicHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border px-5 py-3">
      <Brand />
      <ThemeToggle />
    </header>
  );
}
