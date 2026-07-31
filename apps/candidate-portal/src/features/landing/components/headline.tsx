import type { ReactNode } from 'react';

/** The sentence the landing exists to say. Its one teal word is the only accent on the page. */
export const HEADLINE = {
  before: "Syria's jobs, in one ",
  accent: 'clear',
  after: ' place.',
};

export const HEADLINE_TEXT = `${HEADLINE.before}${HEADLINE.accent}${HEADLINE.after}`;

export const ACCENT = 'border-b-4 border-primary pb-[0.03em] text-primary';

export function HeadlineFrame({ children }: { children: ReactNode }) {
  return <h1 className="max-w-[17ch] font-heading text-display text-foreground">{children}</h1>;
}

export function StaticHeadline() {
  return (
    <HeadlineFrame>
      {HEADLINE.before}
      <span className={ACCENT}>{HEADLINE.accent}</span>
      {HEADLINE.after}
    </HeadlineFrame>
  );
}
