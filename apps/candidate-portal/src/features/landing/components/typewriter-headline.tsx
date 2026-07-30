import type { CSSProperties, ReactNode } from 'react';
import { HEADLINE, HEADLINE_TEXT } from '../headline';
import { ACCENT_CLASS, HEADLINE_CLASS } from './static-headline';
import './typewriter-headline.css';

// Lazy default export: React.lazy loads this (and its CSS) as its own chunk, so only the landing
// pays for the animation. The full text lives in an sr-only node for the accessible name; the
// visible, per-character animated copy is aria-hidden so screen readers never spell it out.

function makeTyper() {
  let index = 0;
  return function type(text: string): ReactNode[] {
    return [...text].map((char) => {
      // Real spaces stay plain text so the headline still wraps between words.
      if (char === ' ') return ' ';
      const at = index++;
      return (
        <span key={at} className="tw-char" style={{ '--tw-i': at } as CSSProperties}>
          {char}
        </span>
      );
    });
  };
}

export default function TypewriterHeadline() {
  const type = makeTyper();
  const lead = type(HEADLINE.lead);
  const accent = type(HEADLINE.accent);
  const tail = type(HEADLINE.tail);
  // The caret rests one step past the last character: it reuses the chars' own stagger formula.
  const caretIndex = HEADLINE_TEXT.replace(/\s/g, '').length;

  return (
    <h1 className={HEADLINE_CLASS}>
      <span className="sr-only">{HEADLINE_TEXT}</span>
      <span aria-hidden="true">
        {lead}
        <span className={ACCENT_CLASS}>{accent}</span>
        {tail}
        <span
          data-testid="hero-caret"
          className="tw-caret"
          style={{ '--tw-i': caretIndex } as CSSProperties}
        />
      </span>
    </h1>
  );
}
