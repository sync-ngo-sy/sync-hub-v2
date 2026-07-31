import { cn } from '@sync/ui/lib/utils';
import { GitBranch, ScanSearch, Sparkles, Users } from 'lucide-react';
import { WRAP } from '../wrap';

const CAPABILITIES = [
  {
    icon: ScanSearch,
    title: 'Automatic screening',
    body: 'Every applicant is scored against your role, with the reasoning shown — not a black box.',
  },
  {
    icon: Sparkles,
    title: 'CVs, read for you',
    body: 'Skills, history, and languages are parsed on upload, so nobody on your team retypes a résumé.',
  },
  {
    icon: GitBranch,
    title: 'One pipeline',
    body: 'Move applications through your own stages on a single board your whole team shares.',
  },
  {
    icon: Users,
    title: 'A talent pool',
    body: 'Keep strong applicants on hand and reach them first the next time you are hiring.',
  },
];

export function Capabilities() {
  return (
    <section className="border-y border-border bg-secondary">
      <div className={cn(WRAP, 'py-[clamp(3.5rem,8vw,6rem)]')}>
        <p className="mb-10 max-w-[46ch] text-h2 font-heading font-medium text-foreground">
          Everything you need to hire, from the first applicant to the offer.
        </p>
        <div className="grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-2">
              <Icon aria-hidden className="size-5 text-accent-foreground" />
              <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
              <p className="max-w-[42ch] text-[15px] text-secondary-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
