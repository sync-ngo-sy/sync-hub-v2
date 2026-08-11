import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSidebarRail } from './use-sidebar-rail';

const KEY = 'sync-test-sidebar';

function viewport(cramped: boolean) {
  const listeners = new Set<() => void>();

  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: cramped,
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));

  return function widen(nowCramped: boolean) {
    cramped = nowCramped;
    act(() => {
      for (const listener of listeners) listener();
    });
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('useSidebarRail', () => {
  it('starts collapsed on a cramped viewport, whatever the reader last chose', () => {
    localStorage.setItem(KEY, 'expanded');
    viewport(true);

    const { result } = renderHook(() => useSidebarRail(KEY));

    expect(result.current.collapsed).toBe(true);
  });

  it('starts from the remembered choice when there is room', () => {
    localStorage.setItem(KEY, 'expanded');
    viewport(false);

    const { result } = renderHook(() => useSidebarRail(KEY));

    expect(result.current.collapsed).toBe(false);
  });

  it('collapses when the viewport becomes cramped, and comes back when it does not', () => {
    localStorage.setItem(KEY, 'expanded');
    const resize = viewport(false);
    const { result } = renderHook(() => useSidebarRail(KEY));

    resize(true);
    expect(result.current.collapsed).toBe(true);

    resize(false);
    expect(result.current.collapsed).toBe(false);
  });

  it('still answers the toggle on a cramped viewport', () => {
    const resize = viewport(true);
    const { result } = renderHook(() => useSidebarRail(KEY));

    act(() => result.current.toggle());

    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('expanded');

    resize(true);
    expect(result.current.collapsed).toBe(false);
  });

  it('remembers a collapse the reader asked for', () => {
    viewport(false);
    const { result } = renderHook(() => useSidebarRail(KEY));

    act(() => result.current.toggle());

    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('collapsed');
  });
});
