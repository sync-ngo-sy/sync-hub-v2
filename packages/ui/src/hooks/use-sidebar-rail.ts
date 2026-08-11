import { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from './use-media-query';

interface SidebarRail {
  collapsed: boolean;
  toggle: () => void;
}

const CRAMPED = '(max-width: 89.999rem)';

function remembered(storageKey: string): boolean {
  return localStorage.getItem(storageKey) === 'collapsed';
}

/** A viewport this narrow owes its width to the work, not to the navigation, so the rail starts
 * collapsed and every crossing of the breakpoint says so again — but the toggle still answers, so a
 * reader who wants the labels back can have them until the viewport changes its mind. */
export function useSidebarRail(storageKey: string): SidebarRail {
  const cramped = useMediaQuery(CRAMPED);
  const [collapsed, setCollapsed] = useState(() => cramped || remembered(storageKey));

  useEffect(() => {
    setCollapsed(cramped || remembered(storageKey));
  }, [cramped, storageKey]);

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem(storageKey, next ? 'collapsed' : 'expanded');
      return next;
    });
  }, [storageKey]);

  return { collapsed, toggle };
}
