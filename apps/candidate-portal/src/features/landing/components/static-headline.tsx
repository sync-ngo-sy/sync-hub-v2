import { HEADLINE } from '../headline';

export const HEADLINE_CLASS = 'max-w-[17ch] text-display text-foreground';
export const ACCENT_CLASS = 'border-b-4 border-primary pb-[0.03em] text-primary';

export function StaticHeadline() {
  return (
    <h1 className={HEADLINE_CLASS}>
      {HEADLINE.lead}
      <span className={ACCENT_CLASS}>{HEADLINE.accent}</span>
      {HEADLINE.tail}
    </h1>
  );
}
