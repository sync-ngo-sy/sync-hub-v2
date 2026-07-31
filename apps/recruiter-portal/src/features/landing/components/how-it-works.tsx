import { cn } from '@sync/ui/lib/utils';
import { WRAP } from '../wrap';

const STEPS = [
  { num: '01', text: 'Post your roles and share one link.' },
  { num: '02', text: 'We read every CV and screen each applicant against the role.' },
  { num: '03', text: 'Work a ranked pipeline with your team.' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-[clamp(3.5rem,8vw,6rem)]">
      <div className={WRAP}>
        <p className="mb-7 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
          How it works
        </p>
        <ol className="flex flex-col border-t border-border sm:flex-row">
          {STEPS.map((step, i) => (
            <li
              key={step.num}
              className={cn(
                'flex flex-1 items-baseline gap-3.5 py-7 sm:pr-6',
                i > 0 && 'border-t border-border sm:border-t-0 sm:border-l sm:pl-6',
              )}
            >
              <span className="text-[15px] font-semibold text-accent-foreground">{step.num}</span>
              <p className="text-[15px] text-secondary-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
