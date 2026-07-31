import { Fragment, useEffect, useState } from 'react';
import { ACCENT, HEADLINE, HEADLINE_TEXT, HeadlineFrame } from './headline';

const CHARACTER_MS = 45;

/** A character's identity is its place in a sentence that never changes, so the key is too. */
const CHARACTERS = [
  ...[...HEADLINE.before].map((character) => ({ character, accent: false })),
  ...[...HEADLINE.accent].map((character) => ({ character, accent: true })),
  ...[...HEADLINE.after].map((character) => ({ character, accent: false })),
].map((entry, position) => ({ ...entry, position, key: `${position}-${entry.character}` }));

function useTypedLength(total: number): number {
  const [typed, setTyped] = useState(0);
  const done = typed >= total;

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setTyped((length) => length + 1), CHARACTER_MS);
    return () => clearInterval(timer);
  }, [done]);

  return Math.min(typed, total);
}

/**
 * The landing's one animation, in its own chunk: the hero imports it lazily, so a reader who
 * asked for less motion — and every other route — never loads it.
 *
 * Every character is in the DOM from the first frame, hidden rather than absent, so the
 * finished layout holds and nothing reflows as the line types itself. Assistive tech reads
 * the sentence once, off the label; the characters themselves are hidden from it.
 */
export default function TypewriterHeadline() {
  const typed = useTypedLength(CHARACTERS.length);

  return (
    <HeadlineFrame>
      <span className="sr-only">{HEADLINE_TEXT}</span>
      <span aria-hidden="true">
        {CHARACTERS.map(({ character, accent, position, key }) => (
          <Fragment key={key}>
            {position === typed ? <Caret /> : null}
            <span
              className={accent ? ACCENT : undefined}
              style={{ visibility: position < typed ? 'visible' : 'hidden' }}
            >
              {character}
            </span>
          </Fragment>
        ))}
        {typed === CHARACTERS.length ? <Caret /> : null}
      </span>
    </HeadlineFrame>
  );
}

/** Zero-width, so it can sit at the typing head without moving a single character. */
function Caret() {
  return (
    <span className="relative inline-block w-0 align-baseline">
      <span className="absolute bottom-[0.08em] left-0 h-[0.72em] w-[0.05em] animate-caret-blink bg-primary" />
    </span>
  );
}
