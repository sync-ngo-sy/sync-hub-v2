import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'sync-candidate-theme';

function preferredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function paint(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, remember] = useState<Theme>(() => {
    const initial = preferredTheme();
    paint(initial);
    return initial;
  });

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    paint(next);
    remember(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme is only available inside a ThemeProvider.');
  return value;
}
