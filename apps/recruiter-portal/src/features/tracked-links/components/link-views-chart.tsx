import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { type LinkViews, viewsSummary } from '../tracked-link';

const ROW_HEIGHT = 44;

export default function LinkViewsChart({ bars }: { bars: LinkViews[] }) {
  return (
    <div
      role="img"
      aria-label={viewsSummary(bars)}
      style={{ height: bars.length * ROW_HEIGHT }}
      className="w-full"
    >
      <BarChart
        responsive
        accessibilityLayer={false}
        data={bars}
        layout="vertical"
        barCategoryGap={12}
        margin={{ top: 4, right: 44, bottom: 4, left: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--secondary-foreground)', fontSize: 13 }}
        />
        <Bar
          dataKey="views"
          radius={5}
          barSize={10}
          isAnimationActive={false}
          background={{ fill: 'var(--muted)', radius: 5 }}
        >
          {bars.map((bar) => (
            <Cell key={bar.id} fill={bar.fill} />
          ))}
          <LabelList
            dataKey="views"
            position="right"
            className="fill-foreground text-meta tabular-nums"
          />
        </Bar>
      </BarChart>
    </div>
  );
}
