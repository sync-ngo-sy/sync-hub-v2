import { TrendingUp, type LucideIcon } from 'lucide-react';

export type TrendTone = 'positive' | 'caution' | 'neutral';

export const TREND_TONE: Record<TrendTone, { color: string; icon?: LucideIcon }> = {
  positive: { color: 'text-success-foreground', icon: TrendingUp },
  caution: { color: 'text-warning-foreground' },
  neutral: { color: 'text-muted-foreground' },
};
