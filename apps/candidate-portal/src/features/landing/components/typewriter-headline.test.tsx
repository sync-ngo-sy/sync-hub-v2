import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEADLINE_TEXT } from './headline';
import TypewriterHeadline from './typewriter-headline';

describe('the typewriter headline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads as the whole sentence to assistive tech from the very first frame', () => {
    render(<TypewriterHeadline />);

    expect(screen.getByRole('heading', { level: 1, name: HEADLINE_TEXT })).toBeInTheDocument();
  });

  it('reveals the sentence a character at a time, holding the finished layout throughout', () => {
    render(<TypewriterHeadline />);

    // Every character is already in the DOM, so nothing reflows as the line types itself.
    expect(screen.getByText('S')).not.toBeVisible();
    expect(screen.getByText('.')).not.toBeVisible();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText('S')).toBeVisible();
    expect(screen.getByText('.')).not.toBeVisible();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByText('.')).toBeVisible();
  });

  it('stops typing once the sentence is finished', () => {
    render(<TypewriterHeadline />);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(vi.getTimerCount()).toBe(0);
  });
});
