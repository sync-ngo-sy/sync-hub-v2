import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PhoneField, type PhoneValue } from './phone-field';

function Editor({ start }: { start?: PhoneValue }) {
  const [value, setValue] = useState<PhoneValue>(start ?? { country: '', number: '' });
  return (
    <>
      <label htmlFor="phone">Phone</label>
      <PhoneField id="phone" value={value} onChange={setValue} />
    </>
  );
}

const number = () => screen.getByRole('textbox', { name: 'Phone' });
const picker = () => screen.getByRole('combobox', { name: 'Country' });

describe('PhoneField', () => {
  it('draws a flag beside each country it offers', async () => {
    const user = userEvent.setup();
    render(<Editor />);

    await user.click(picker());
    await user.keyboard('Syria');

    const option = await screen.findByRole('option', { name: 'Syria (+963)' });
    expect(option.querySelector('img')).toBeInTheDocument();
  });

  it('keeps the country the candidate picked, and flies its flag', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editor />);

    await user.click(picker());
    await user.keyboard('Syria');
    await user.click(await screen.findByRole('option', { name: 'Syria (+963)' }));

    expect(picker()).toHaveValue('Syria (+963)');
    expect(picker().parentElement?.querySelector('img')).toBeInTheDocument();
    expect(container.querySelector('[role="option"]')).toBeNull();
  });

  it('shows the country a saved profile was written with', () => {
    render(<Editor start={{ country: 'SY', number: '011 555 0134' }} />);

    expect(picker()).toHaveValue('Syria (+963)');
    expect(number()).toHaveValue('011 555 0134');
  });

  it('reads the country off a pasted international number and leaves the rest behind', async () => {
    const user = userEvent.setup();
    render(<Editor start={{ country: 'LB', number: '' }} />);

    await user.click(number());
    await user.paste('+963 11 555 0134');

    expect(picker()).toHaveValue('Syria (+963)');
    expect(number()).toHaveValue('115550134');
  });

  it('takes a dial code as the country, and takes it out of the field', async () => {
    const user = userEvent.setup();
    render(<Editor />);

    await user.type(number(), '+963');

    expect(picker()).toHaveValue('Syria (+963)');
    expect(number()).toHaveValue('');
  });

  it('leaves a national number exactly as it was typed', async () => {
    const user = userEvent.setup();
    render(<Editor start={{ country: 'SY', number: '' }} />);

    await user.type(number(), '011 555 0134');

    expect(picker()).toHaveValue('Syria (+963)');
    expect(number()).toHaveValue('011 555 0134');
  });
});
