import { Button } from '@sync/ui/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export function ThemeToggle({ variant = 'outline' }: { variant?: 'outline' | 'sidebar' }) {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant={variant}
      size="icon"
      aria-label={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
