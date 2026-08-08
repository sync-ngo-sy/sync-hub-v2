import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TagList } from './tag-list';

const FOUR = ['Arabic speaker', 'Interviewed', 'Referred', 'Shortlisted'];

function listed(label: string): string[] {
  return within(screen.getByRole('list', { name: label }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

describe('a list of Tags in a table row', () => {
  it('shows every Tag when they all fit', () => {
    render(<TagList label="Tags on Rana Haddad" names={['Arabic speaker', 'Interviewed']} />);

    expect(listed('Tags on Rana Haddad')).toEqual(['Arabic speaker', 'Interviewed']);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('holds the rest back rather than letting a row grow', () => {
    render(<TagList label="Tags on Rana Haddad" names={FOUR} />);

    expect(listed('Tags on Rana Haddad')).toEqual(['Arabic speaker', 'Interviewed', '+2 more']);
    expect(screen.queryByText('Referred')).not.toBeInTheDocument();
  });

  it('shows the rest on hover, which is what the count promises', async () => {
    const user = userEvent.setup();
    render(<TagList label="Tags on Rana Haddad" names={FOUR} />);

    await user.hover(screen.getByRole('button', { name: '+2 more' }));

    expect(await screen.findByText('Referred')).toBeVisible();
    expect(screen.getByText('Shortlisted')).toBeVisible();
  });

  it('shows them to a keyboard as well, which never hovers', async () => {
    const user = userEvent.setup();
    render(<TagList label="Tags on Rana Haddad" names={FOUR} />);

    await user.tab();

    expect(screen.getByRole('button', { name: '+2 more' })).toHaveFocus();
    expect(await screen.findByText('Referred')).toBeVisible();
  });
});
