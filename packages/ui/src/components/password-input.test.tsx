import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PasswordInput } from './password-input';

describe('the password input', () => {
  it('hides what is typed until the eye is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" defaultValue="Correct-Horse9" />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('hides it again on a second click', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" />);

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    await user.click(screen.getByRole('button', { name: 'Hide password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('says whether the password is showing', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('never submits the form it sits in', () => {
    render(<PasswordInput aria-label="Password" />);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
