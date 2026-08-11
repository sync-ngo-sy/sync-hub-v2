import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';

function preferredTheme(storageKey: string): Theme {
  const stored = localStorage.getItem(storageKey);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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

interface ThemeProviderProps {
  storageKey: string;
  children: ReactNode;
}

export function ThemeProvider({ storageKey, children }: ThemeProviderProps) {
  const [theme, remember] = useState<Theme>(() => {
    const initial = preferredTheme(storageKey);
    paint(initial);
    return initial;
  });

  const setTheme = useCallback(
    (next: Theme) => {
      localStorage.setItem(storageKey, next);
      paint(next);
      remember(next);
    },
    [storageKey],
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme is only available inside a ThemeProvider.');
  return value;
}
