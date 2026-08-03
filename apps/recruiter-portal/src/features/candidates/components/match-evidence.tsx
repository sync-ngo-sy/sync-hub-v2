import type { MatchEvidence } from '../candidate';

export function MatchEvidenceNote({ evidence }: { evidence: MatchEvidence | null }) {
  if (!evidence) return null;

  return (
    <figure className="space-y-1 border-s-2 border-border ps-3">
      <blockquote className="text-dense text-muted-foreground">{evidence.text}</blockquote>
      <figcaption className="text-meta text-muted-foreground">{evidence.where}</figcaption>
    </figure>
  );
}
