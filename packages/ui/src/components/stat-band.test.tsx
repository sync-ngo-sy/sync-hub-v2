import { render, screen } from '@testing-library/react';
import { BriefcaseBusiness } from 'lucide-react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { StatBand } from './stat-band';

function JobsLink(props: ComponentProps<'a'>) {
  return <a href="/jobs" {...props} />;
}

describe('StatBand', () => {
  it('shows an icon and direction arrow on a linked stat', () => {
    const { container } = render(
      <StatBand
        variant="cards"
        items={[
          {
            label: 'Open jobs',
            value: 9,
            icon: BriefcaseBusiness,
            render: <JobsLink />,
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: /Open jobs/ })).toBeVisible();
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });
});
