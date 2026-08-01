import { Eyebrow, Wrap } from './editorial';

const STEPS = [
  'Create your profile.',
  'Upload your CV — we read it for you.',
  'Apply and track every step.',
];

export function HowItWorks() {
  return (
    <section className="py-[clamp(3.5rem,8vw,6rem)]">
      <Wrap>
        <Eyebrow className="mb-7">How it works</Eyebrow>
        <ol className="flex flex-col border-t border-border sm:flex-row">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="flex flex-1 items-baseline gap-3.5 border-t border-border py-5 first:border-t-0 sm:border-t-0 sm:border-l sm:py-0 sm:pt-7 sm:pr-6 sm:pl-6 sm:first:border-l-0 sm:first:pl-0"
            >
              <span className="text-[0.9375rem] font-semibold text-accent-foreground">
                {`0${index + 1}`}
              </span>
              <p className="text-[0.9375rem] text-secondary-foreground">{step}</p>
            </li>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}
