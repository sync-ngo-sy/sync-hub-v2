import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CandidateCard } from './candidate-card';

const WHOLE = {
  name: 'Lina Khoury',
  avatarUrl: 'https://cdn.example.test/lina.webp',
  email: 'lina@example.test',
  phone: '+963 11 555 0100',
  role: 'Project Manager',
  yearsOfExperience: 6,
  languages: ['Arabic', 'English'],
};

describe('CandidateCard', () => {
  it('is one block of a page, named for the person it describes', () => {
    render(<CandidateCard {...WHOLE} />);

    expect(screen.getByRole('article', { name: 'Lina Khoury' })).toBeVisible();
  });

  it('shows every key fact it is given', () => {
    render(<CandidateCard {...WHOLE} />);

    expect(screen.getByText('Lina Khoury')).toBeVisible();
    expect(screen.getByText('Project Manager')).toBeVisible();
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

  it('stands the initials in until a photo has loaded, so nothing looks broken', () => {
    render(<CandidateCard {...WHOLE} />);

    expect(screen.getByText('LK')).toBeInTheDocument();
  });

  it('falls back to the initials when there is no photo at all', () => {
    render(<CandidateCard name="Lina Khoury" />);

    expect(screen.getByText('LK')).toBeInTheDocument();
  });

  it('takes the first two initials of a longer name, and copes with one', () => {
    const { rerender } = render(<CandidateCard name="Amina  Nour  Haddad" />);
    expect(screen.getByText('AN')).toBeInTheDocument();

    rerender(<CandidateCard name="Amina" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
