import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { FormField } from './form-field';
import { Input } from './ui/input';

function Harness({ withError, description }: { withError?: boolean; description?: string }) {
  const form = useForm<{ email: string }>({ defaultValues: { email: '' } });
  useEffect(() => {
    if (withError) form.setError('email', { type: 'manual', message: 'Email is required' });
  }, [withError, form]);
  return (
    <FormField control={form.control} name="email" label="Email address" description={description}>
      {(field) => <Input {...field} placeholder="you@example.com" />}
    </FormField>
  );
}

describe('FormField', () => {
  it('associates the label with its control and records typed input', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Email address');
    await userEvent.type(input, 'a@b.co');
    expect(input).toHaveValue('a@b.co');
  });

  it('links a description to the control via aria-describedby', () => {
    render(<Harness description="We never share it." />);
    const input = screen.getByLabelText('Email address');
    const description = screen.getByText('We never share it.');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining(description.id));
  });

  it('marks the field invalid and announces the error, describing the control by it', async () => {
    render(<Harness withError />);
    const input = screen.getByLabelText('Email address');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email is required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining(alert.id));
  });
});
