import { createContext, type ReactNode, useContext, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

function apply(theme: Theme) {
  localStorage.setItem('sync-platform-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggle: () =>
          setTheme((current) => {
            const next = current === 'light' ? 'dark' : 'light';
            apply(next);
            return next;
          }),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be inside ThemeProvider.');
  return theme;
}
