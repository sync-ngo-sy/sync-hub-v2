import { buttonVariants } from '@sync/ui/components/ui/button';
import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps a colour that a named type step is merged with', () => {
    expect(cn(buttonVariants(), 'h-10 px-4 text-dense')).toContain('text-primary-foreground');
  });

  it('still lets one type step replace another', () => {
    expect(cn('text-dense', 'text-reading')).toBe('text-reading');
  });

  it('still lets one colour replace another', () => {
    expect(cn('text-primary-foreground', 'text-foreground')).toBe('text-foreground');
  });
});
