import { Badge } from '@sync/ui/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@sync/ui/components/ui/hover-card';

const FIT_IN_A_ROW = 2;

interface TagListProps {
  label: string;
  names: string[];
}

export function TagList({ label, names }: TagListProps) {
  const upFront = names.slice(0, FIT_IN_A_ROW);
  const rest = names.slice(FIT_IN_A_ROW);

  return (
    <ul aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {upFront.map((name) => (
        <li key={name}>
          <Badge variant="tag" size="sm" className="max-w-40 truncate">
            {name}
          </Badge>
        </li>
      ))}

      {rest.length > 0 ? (
        <li>
          <HoverCard>
            <HoverCardTrigger
              render={<button type="button" />}
              onClick={(event) => event.stopPropagation()}
              className="rounded-4xl text-meta text-muted-foreground underline decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {`+${rest.length} more`}
            </HoverCardTrigger>
            <HoverCardContent>
              <ul aria-label={`${label}, the rest`} className="flex flex-wrap gap-1.5">
                {rest.map((name) => (
                  <li key={name}>
                    <Badge variant="tag" size="sm">
                      {name}
                    </Badge>
                  </li>
                ))}
              </ul>
            </HoverCardContent>
          </HoverCard>
        </li>
      ) : null}
    </ul>
  );
}
