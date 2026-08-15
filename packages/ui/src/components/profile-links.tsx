import { Fragment } from 'react';
import type { CandidateFact } from './candidate-card';

export interface ProfileLinks {
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
}

interface Destination {
  name: string;
  url: string;
}

const SCHEME_AND_WWW = /^https?:\/\/(www\.)?/;

/** A portfolio is named by where it goes, because "Portfolio" says nothing LinkedIn does not. */
function siteName(url: string): string {
  return url.replace(SCHEME_AND_WWW, '').replace(/\/$/, '');
}

/**
 * The Links a page hands its Candidate Card as one fact — or nothing to hand it, when the
 * Candidate has claimed none. A fact, rather than a second contact line, because what is worth
 * saying about a candidate is the page's decision and the card only renders it.
 */
export function linksFact(links: ProfileLinks): CandidateFact {
  const destinations: Destination[] = [
    { name: 'LinkedIn', url: links.linkedinUrl ?? '' },
    { name: 'GitHub', url: links.githubUrl ?? '' },
    { name: siteName(links.portfolioUrl ?? ''), url: links.portfolioUrl ?? '' },
  ].filter((destination) => destination.url !== '');

  return {
    label: 'Links',
    value: destinations.length > 0 ? <LinkList destinations={destinations} /> : null,
  };
}

function LinkList({ destinations }: { destinations: Destination[] }) {
  return (
    <>
      {destinations.map((destination, index) => (
        <Fragment key={destination.name}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          <a
            href={destination.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-primary"
          >
            {destination.name}
          </a>
        </Fragment>
      ))}
    </>
  );
}
