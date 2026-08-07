import { type LinkViews, viewsSummary } from '../tracked-link';

export default function LinkViewsChart({ bars }: { bars: LinkViews[] }) {
  const most = Math.max(...bars.map((bar) => bar.views), 1);

  return (
    <div role="img" aria-label={viewsSummary(bars)} className="flex flex-col gap-3.5">
      {bars.map((bar) => (
        <div key={bar.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
          <span className="truncate text-meta text-secondary-foreground">{bar.name}</span>
          <span className="text-meta tabular-nums text-foreground">{bar.views}</span>
          <span className="col-span-2 mt-1.5 block h-2 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(bar.views / most) * 100}%`, background: bar.fill }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
