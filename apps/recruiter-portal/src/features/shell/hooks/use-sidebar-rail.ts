import { useCallback, useState } from 'react';

export const RAIL_STORAGE_KEY = 'sync-recruiter-sidebar';

interface SidebarRail {
  collapsed: boolean;
  toggle: () => void;
}

export function useSidebarRail(): SidebarRail {
  const [collapsed, remember] = useState(
    () => localStorage.getItem(RAIL_STORAGE_KEY) === 'collapsed',
  );

  const toggle = useCallback(() => {
    remember((previous) => {
      const next = !previous;
      localStorage.setItem(RAIL_STORAGE_KEY, next ? 'collapsed' : 'expanded');
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
