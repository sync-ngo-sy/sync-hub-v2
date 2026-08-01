import { Eyebrow, Wrap } from './page-parts';

const STEPS = [
  {
    title: 'Create your workspace',
    body: 'Your company gets its own Sync. Invite the people who hire with you.',
  },
  {
    title: 'Publish a job with its criteria',
    body: 'Say what the role needs. Those criteria are what every applicant is measured against.',
  },
  {
    title: 'Work the pipeline',
    body: 'Review who qualified, message them, and move them through to an offer.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-20 border-t border-border py-[clamp(3.5rem,7vw,5.5rem)]"
    >
      <Wrap>
        <Eyebrow className="mb-4">How it works</Eyebrow>
        <h2
          id="how-it-works-heading"
          className="mb-9 max-w-[26ch] font-heading text-h2 text-foreground"
        >
          Three steps to your first hire.
        </h2>

        <ol className="flex flex-col border-t border-border sm:flex-row">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex-1 border-t border-border py-6 first:border-t-0 sm:border-t-0 sm:border-l sm:py-0 sm:pt-7 sm:pr-8 sm:pl-7 sm:first:border-l-0 sm:first:pl-0"
            >
              <span className="text-meta font-semibold text-accent-foreground">
                {`0${index + 1}`}
              </span>
              <h3 className="mt-2 text-title text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-dense text-secondary-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}
