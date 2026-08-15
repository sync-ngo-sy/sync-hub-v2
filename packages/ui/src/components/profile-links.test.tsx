import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CandidateCard } from './candidate-card';
import { linksFact, type ProfileLinks } from './profile-links';

const WHOLE: ProfileLinks = {
  linkedinUrl: 'https://www.linkedin.com/in/lina-khoury',
  githubUrl: 'https://github.com/lina-khoury',
  portfolioUrl: 'https://lina-khoury.dev',
};

function aCard(links: ProfileLinks) {
  return render(<CandidateCard name="Lina Khoury" facts={[linksFact(links)]} />);
}

describe('the Links a card is given as a fact', () => {
  it('names each destination and goes there', () => {
    aCard(WHOLE);

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
    aCard(WHOLE);

    const linkedin = screen.getByRole('link', { name: 'LinkedIn' });
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAttribute('rel', 'noreferrer');
  });

  it('lists only the links the candidate claimed', () => {
    aCard({ githubUrl: 'https://github.com/lina-khoury' });

    expect(screen.getByRole('link', { name: 'GitHub' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'LinkedIn' })).not.toBeInTheDocument();
  });

  it('says nothing at all where there is nothing to say', () => {
    aCard({});

    expect(screen.queryByText('Links')).not.toBeInTheDocument();
  });
});
