import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateCard } from './candidate-card';

class PhotoThatLoads {
  onload: (() => void) | null = null;
  set src(_address: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

const WHOLE = {
  name: 'Lina Khoury',
  links: {},
  avatarUrl: 'https://cdn.example.test/lina.webp',
  email: 'lina@example.test',
  phone: '+963 11 555 0100',
  canonicalRole: 'Project Manager',
  headline: 'Runs delivery for two field programmes',
  facts: [
    { label: 'Total experience', value: '6 years' },
    { label: 'Languages', value: 'Arabic, English' },
  ],
};

describe('CandidateCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is one block of a page, named for the person it describes', () => {
    render(<CandidateCard {...WHOLE} />);

    expect(screen.getByRole('article', { name: 'Lina Khoury' })).toBeVisible();
  });

  it('carries the page’s own heading, because the page is about this person', () => {
    render(<CandidateCard {...WHOLE} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Lina Khoury' })).toBeVisible();
  });

  it('can sit under a page heading without creating a second h1', () => {
    render(<CandidateCard {...WHOLE} headingLevel={2} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Lina Khoury' })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows every key fact it is given', () => {
    render(<CandidateCard {...WHOLE} />);

    expect(screen.getByText('Lina Khoury')).toBeVisible();
    expect(screen.getByText('Project Manager')).toBeVisible();
    expect(screen.getByText('Runs delivery for two field programmes')).toBeVisible();
    expect(screen.getByText('lina@example.test')).toBeVisible();
    expect(screen.getByText('+963 11 555 0100')).toBeVisible();
    expect(screen.getByText('6 years')).toBeVisible();
    expect(screen.getByText('Arabic, English')).toBeVisible();
  });

  it('reaches the candidate by mail and by phone rather than only naming them', () => {
    render(<CandidateCard {...WHOLE} />);

    expect(screen.getByRole('link', { name: 'lina@example.test' })).toHaveAttribute(
      'href',
      'mailto:lina@example.test',
    );
    expect(screen.getByRole('link', { name: '+963 11 555 0100' })).toHaveAttribute(
      'href',
      'tel:+963 11 555 0100',
    );
  });

  it('needs nothing but a name', () => {
    render(<CandidateCard name="Lina Khoury" links={{}} />);

    expect(screen.getByText('Lina Khoury')).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
    for (const label of ['Total experience', 'Languages']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('omits a field it is not given rather than labelling an empty one', () => {
    render(
      <CandidateCard
        {...WHOLE}
        phone={null}
        facts={[
          { label: 'Total experience', value: '6 years' },
          { label: 'Languages', value: null },
        ]}
      />,
    );

    expect(screen.getByText('lina@example.test')).toBeVisible();
    expect(screen.queryByText('+963 11 555 0100')).toBeNull();
    expect(screen.getByText('Total experience')).toBeVisible();
    expect(screen.queryByText('Languages')).toBeNull();
  });

  it('names its fact list, so a page reading two people can tell them apart', () => {
    render(<CandidateCard {...WHOLE} factsLabel="Application facts" />);

    const facts = within(screen.getByLabelText('Application facts'));
    expect(facts.getByText('6 years')).toBeVisible();
  });

  it('shows the photo once it has loaded, left out of the reading order', async () => {
    vi.stubGlobal('Image', PhotoThatLoads);
    render(<CandidateCard {...WHOLE} />);

    await waitFor(() => expect(document.querySelector('img')).not.toBeNull());
    expect(document.querySelector('img')).toHaveAttribute('src', WHOLE.avatarUrl);
    expect(document.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('stands the initials in until the photo has loaded, so nothing looks broken', () => {
    render(<CandidateCard {...WHOLE} />);

    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('LK')).toBeInTheDocument();
  });

  it('falls back to the initials when there is no photo at all', async () => {
    vi.stubGlobal('Image', PhotoThatLoads);
    render(<CandidateCard name="Lina Khoury" links={{}} />);

    expect(screen.getByText('LK')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('img')).toBeNull());
  });

  it('takes the first two initials of a longer name, and copes with one', () => {
    const { rerender } = render(<CandidateCard name="Amina  Nour  Haddad" links={{}} />);
    expect(screen.getByText('AN')).toBeInTheDocument();

    rerender(<CandidateCard name="Amina" links={{}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});

describe('the Links on a Candidate Card', () => {
  const LINKED = {
    name: 'Lina Khoury',
    links: {
      linkedinUrl: 'https://www.linkedin.com/in/lina-khoury',
      githubUrl: 'https://github.com/lina-khoury',
      portfolioUrl: 'https://lina-khoury.dev',
    },
  };

  it('names each destination and goes there', () => {
    render(<CandidateCard {...LINKED} />);

    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/lina-khoury',
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/lina-khoury',
    );
    expect(screen.getByRole('link', { name: 'lina-khoury.dev' })).toHaveAttribute(
      'href',
      'https://lina-khoury.dev',
    );
  });

  it('opens somewhere else without handing the platform over with it', () => {
    render(<CandidateCard {...LINKED} />);

    const linkedin = screen.getByRole('link', { name: 'LinkedIn' });
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAttribute('rel', 'noreferrer');
  });

  it('shows only the Links the candidate claimed', () => {
    render(<CandidateCard name="Lina Khoury" links={{ githubUrl: 'https://github.com/lina' }} />);

    expect(screen.getByRole('link', { name: 'GitHub' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'LinkedIn' })).not.toBeInTheDocument();
  });

  it('says nothing at all where the candidate claimed none', () => {
    render(<CandidateCard name="Lina Khoury" links={{}} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
