import { Card, CardContent, CardHeader } from '@sync/ui/components/ui/card';
import { ListChecks, MessageSquareText, Star, Workflow } from 'lucide-react';
import type { ComponentType } from 'react';
import { Eyebrow, Wrap } from './page-parts';

interface Capability {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

const CAPABILITIES: Capability[] = [
  {
    icon: ListChecks,
    title: 'Screening that runs itself',
    body: 'Set the criteria for a job once. Every application is measured against them the moment it lands, so you open a shortlist rather than an inbox.',
  },
  {
    icon: Workflow,
    title: 'One pipeline, first look to offer',
    body: 'Move an application from new to hired in a single view, and the candidate is told where they stand at each step.',
  },
  {
    icon: Star,
    title: 'A talent pool that remembers',
    body: 'Notes, tags and saved candidates stay with your workspace, so a strong applicant for one role is still there for the next.',
  },
  {
    icon: MessageSquareText,
    title: 'Messages that sound like you',
    body: 'Write your outreach and decision templates once, then send them from the application itself, with a record of what was sent.',
  },
];

export function WhatYouGet() {
  return (
    <section
      id="what-you-get"
      aria-labelledby="what-you-get-heading"
      className="scroll-mt-20 border-t border-border py-[clamp(3.5rem,7vw,5.5rem)]"
    >
      <Wrap>
        <Eyebrow className="mb-4">What you get</Eyebrow>
        <h2
          id="what-you-get-heading"
          className="mb-10 max-w-[26ch] font-heading text-h2 text-foreground"
        >
          A hiring workspace, not another inbox.
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="h-full">
              <CardHeader className="gap-3">
                <Icon className="size-5 text-primary" />
                <h3 className="text-title text-foreground">{title}</h3>
              </CardHeader>
              <CardContent className="text-dense text-secondary-foreground">{body}</CardContent>
            </Card>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
