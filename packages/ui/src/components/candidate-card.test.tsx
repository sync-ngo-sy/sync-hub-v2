import { render, screen, waitFor } from '@testing-library/react';
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
  avatarUrl: 'https://cdn.example.test/lina.webp',
  email: 'lina@example.test',
  phone: '+963 11 555 0100',
  role: 'Project Manager',
  headline: 'Runs delivery for two field programmes',
  yearsOfExperience: 6,
  languages: ['Arabic', 'English'],
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

  it('needs nothing but a name', () => {
    render(<CandidateCard name="Lina Khoury" />);

    expect(screen.getByText('Lina Khoury')).toBeVisible();
    for (const label of ['Email', 'Phone', 'Total experience', 'Languages']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('says beside the name and under the facts where the facts came from', () => {
    render(<CandidateCard {...WHOLE} mark="Snapshot" note="Frozen when they applied." />);

    expect(screen.getByText('Snapshot')).toBeVisible();
    expect(screen.getByText('Frozen when they applied.')).toBeVisible();
  });

  it('says nothing about provenance where the card was given none', () => {
    render(<CandidateCard {...WHOLE} />);

    expect(screen.queryByText('Snapshot')).toBeNull();
  });

  it('omits a field it is not given rather than labelling an empty one', () => {
    render(<CandidateCard {...WHOLE} phone={null} languages={[]} />);

    expect(screen.getByText('Email')).toBeVisible();
    expect(screen.queryByText('Phone')).toBeNull();
    expect(screen.queryByText('Languages')).toBeNull();
  });

  it('counts a single year in the singular', () => {
    render(<CandidateCard name="Lina Khoury" yearsOfExperience={1} />);

    expect(screen.getByText('1 year')).toBeVisible();
  });

  it('says no experience rather than hiding the answer', () => {
    render(<CandidateCard name="Lina Khoury" yearsOfExperience={0} />);

    expect(screen.getByText('Total experience')).toBeVisible();
    expect(screen.getByText('0 years')).toBeVisible();
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
    render(<CandidateCard name="Lina Khoury" />);

    expect(screen.getByText('LK')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('img')).toBeNull());
  });

  it('takes the first two initials of a longer name, and copes with one', () => {
    const { rerender } = render(<CandidateCard name="Amina  Nour  Haddad" />);
    expect(screen.getByText('AN')).toBeInTheDocument();

    rerender(<CandidateCard name="Amina" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
