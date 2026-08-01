import { Fragment, useEffect, useState } from 'react';
import { ACCENT, HEADLINE, HEADLINE_TEXT, HeadlineFrame } from './headline';

const CHARACTER_MS = 68;
const JITTER = 0.25;
const AFTER_COMMA_MS = 260;
const BEFORE_ACCENT_MS = 190;
const ACCENT_START = HEADLINE.before.length;

function delayBefore(position: number): number {
  const jittered = CHARACTER_MS * (1 + (Math.random() * 2 - 1) * JITTER);
  const typed = HEADLINE_TEXT[position - 1];

  return (
    jittered +
    (typed === ',' ? AFTER_COMMA_MS : 0) +
    (position === ACCENT_START ? BEFORE_ACCENT_MS : 0)
  );
}

const CHARACTERS = [
  ...[...HEADLINE.before].map((character) => ({ character, accent: false })),
  ...[...HEADLINE.accent].map((character) => ({ character, accent: true })),
  ...[...HEADLINE.after].map((character) => ({ character, accent: false })),
].map((entry, position) => ({ ...entry, position, key: `${position}-${entry.character}` }));

type Character = (typeof CHARACTERS)[number];
interface Run {
  key: string;
  space: boolean;
  characters: Character[];
}

const RUNS: Run[] = [];

for (const entry of CHARACTERS) {
  const space = entry.character === ' ';
  const current = RUNS.at(-1);

  if (space || !current || current.space) {
    RUNS.push({ key: entry.key, space, characters: [entry] });
  } else {
    current.characters.push(entry);
  }
}

function useTypedLength(total: number): number {
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const reveal = (length: number) => {
      if (length > total) return;
      timer = setTimeout(
        () => {
          setTyped(length);
          reveal(length + 1);
        },
        delayBefore(length - 1),
      );
    };

    reveal(1);
    return () => clearTimeout(timer);
  }, [total]);

  return Math.min(typed, total);
}

export default function TypewriterHeadline() {
  const typed = useTypedLength(CHARACTERS.length);

  return (
    <HeadlineFrame>
      <span className="sr-only">{HEADLINE_TEXT}</span>
      <span aria-hidden="true">
        {RUNS.map((run) => (
          <span key={run.key} className={run.space ? undefined : 'whitespace-nowrap'}>
            {run.characters.map(({ character, accent, position, key }) => (
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
          </span>
        ))}
        {typed === CHARACTERS.length ? <Caret /> : null}
      </span>
    </HeadlineFrame>
  );
}

function Caret() {
  return (
    <span className="relative inline-block w-0 align-baseline">
      <span className="absolute bottom-[-0.06em] left-0 h-[0.8em] w-[0.05em] animate-caret-blink bg-primary" />
    </span>
  );
}
