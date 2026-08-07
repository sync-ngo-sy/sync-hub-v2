import { useCallback, useState } from 'react';

interface SidebarRail {
  collapsed: boolean;
  toggle: () => void;
}

export function useSidebarRail(storageKey: string): SidebarRail {
  const [collapsed, remember] = useState(() => localStorage.getItem(storageKey) === 'collapsed');

  const toggle = useCallback(() => {
    remember((previous) => {
      const next = !previous;
      localStorage.setItem(storageKey, next ? 'collapsed' : 'expanded');
      return next;
    });
  }, [storageKey]);

  return { collapsed, toggle };
}
