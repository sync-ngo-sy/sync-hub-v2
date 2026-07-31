import { zodResolver } from '@hookform/resolvers/zod';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Input } from '@sync/ui/components/ui/input';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FormField } from './form-field';

const schema = z.object({
  email: z.email('Enter a valid email address.'),
  terms: z.boolean().refine((accepted) => accepted, 'Accept the terms to continue.'),
});

type Values = z.output<typeof schema>;

function SignUpForm({
  description,
  termsDescription,
  onValid = vi.fn(),
}: {
  description?: string;
  termsDescription?: string;
  onValid?: (values: Values) => void;
}) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', terms: false },
  });

  return (
    <form onSubmit={form.handleSubmit(onValid)} noValidate>
      <FormField
        control={form.control}
        name="email"
        label="Email address"
        description={description}
      >
        {(field) => <Input {...field} type="email" />}
      </FormField>
      <FormField
        control={form.control}
        name="terms"
        label="Accept the terms"
        description={termsDescription}
        orientation="horizontal"
      >
        {({ value, onChange, ...field }) => (
          <Checkbox {...field} checked={value === true} onCheckedChange={onChange} />
        )}
      </FormField>
      <button type="submit">Create account</button>
    </form>
  );
}

describe('FormField', () => {
  it('labels its control, so the label reaches it by accessible name', () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText('Email address')).toHaveAttribute('type', 'email');
    expect(screen.getByRole('checkbox', { name: 'Accept the terms' })).toBeInTheDocument();
  });

  it('describes the control with its description', () => {
    render(<SignUpForm description="We only use this to contact you about applications." />);

    expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription(
      'We only use this to contact you about applications.',
    );
  });

  it('leaves the control valid and undescribed while the field has no error', () => {
    render(<SignUpForm />);

    const input = screen.getByLabelText('Email address');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces a validation error, marks the control invalid, and describes it with the error', async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Enter a valid email address.',
      'Accept the terms to continue.',
    ]);

    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email address.');
  });

  it('keeps the description and the error both reachable once the field fails', async () => {
    const user = userEvent.setup();
    render(<SignUpForm description="Use the address you check most." />);

    await user.type(screen.getByLabelText('Email address'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByText('Enter a valid email address.');
    expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription(
      'Use the address you check most. Enter a valid email address.',
    );
  });

  it('wires a composite control the same way it wires a native input', async () => {
    const user = userEvent.setup();
    render(<SignUpForm termsDescription="You can withdraw an application at any time." />);

    expect(screen.getByRole('checkbox', { name: 'Accept the terms' })).toHaveAccessibleDescription(
      'You can withdraw an application at any time.',
    );

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByText('Accept the terms to continue.');
    expect(screen.getByRole('checkbox', { name: 'Accept the terms' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('submits what the keyboard typed and toggled', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<SignUpForm onValid={onValid} />);

    await user.tab();
    await user.keyboard('lina@example.com');
    await user.tab();
    await user.keyboard(' ');
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onValid.mock.calls[0]?.[0]).toMatchObject({
      email: 'lina@example.com',
      terms: true,
    });
  });
});
