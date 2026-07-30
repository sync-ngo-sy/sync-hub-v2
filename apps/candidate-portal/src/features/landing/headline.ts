// The single teal word is "clear"; lead and tail keep their edge spaces so the three pieces
// concatenate to the full headline the static and animated variants must agree on.
export const HEADLINE = {
  lead: "Syria's jobs, in one ",
  accent: 'clear',
  tail: ' place.',
} as const;

export const HEADLINE_TEXT = `${HEADLINE.lead}${HEADLINE.accent}${HEADLINE.tail}`;
