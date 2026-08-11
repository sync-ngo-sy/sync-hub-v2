import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Combobox } from './combobox';

const MEAL = { value: 'meal', label: 'Monitoring, Evaluation, Accountability and Learning' };
const LOGISTICS = { value: 'logistics', label: 'Logistics' };
const PROTECTION = { value: 'protection', label: 'Protection' };
const FLEET = { value: 'fleet', label: 'Fleet management' };

const SKILLS = [MEAL, LOGISTICS, PROTECTION];

const GROUPED_SKILLS = [
  { label: 'Programme', options: [MEAL, PROTECTION] },
  { label: 'Operations', options: [LOGISTICS, FLEET] },
];

function highlighted(combobox: HTMLElement) {
  const id = combobox.getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

describe('Combobox', () => {
  it('opens on click and lists every option', async () => {
    const user = userEvent.setup();
    render(<Combobox aria-label="Skill" options={SKILLS} />);

    await user.click(screen.getByRole('combobox', { name: 'Skill' }));

    expect(screen.getByRole('option', { name: 'Logistics' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(SKILLS.length);
  });

  it('names the button that opens the list', () => {
    render(<Combobox aria-label="Skill" options={SKILLS} />);

    expect(screen.getByRole('button', { name: 'Show options' })).toBeInTheDocument();
  });

  it('narrows the list to what was typed', async () => {
    const user = userEvent.setup();
    render(<Combobox aria-label="Skill" options={SKILLS} />);

    await user.click(screen.getByRole('combobox', { name: 'Skill' }));
    await user.keyboard('logi');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Logistics' })).toBeInTheDocument();
  });

  it('says so in words when nothing matches, rather than showing a blank panel', async () => {
    const user = userEvent.setup();
    render(<Combobox aria-label="Skill" options={SKILLS} emptyMessage="No skill by that name." />);

    await user.click(screen.getByRole('combobox', { name: 'Skill' }));
    await user.keyboard('nursing');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No skill by that name.')).toBeInTheDocument();
  });

  it('reports a single choice by its value and shows its label', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Combobox aria-label="Skill" options={SKILLS} onValueChange={onValueChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Skill' }));
    await user.click(screen.getByRole('option', { name: 'Logistics' }));

    expect(onValueChange).toHaveBeenCalledWith('logistics');
    expect(screen.getByRole('combobox', { name: 'Skill' })).toHaveValue('Logistics');
  });

  it('shows the label of a value it was given', () => {
    render(<Combobox aria-label="Skill" options={SKILLS} value="protection" />);

    expect(screen.getByRole('combobox', { name: 'Skill' })).toHaveValue('Protection');
  });

  it('announces a list still arriving instead of reading as empty', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        aria-label="Skill"
        options={[]}
        loading
        loadingMessage="Loading skills…"
        emptyMessage="No skill by that name."
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Skill' }));

    const message = screen.getByText('Loading skills…', { exact: false });
    expect(message.closest('[aria-live="polite"]')).toBeInTheDocument();
    expect(screen.queryByText('No skill by that name.', { exact: false })).not.toBeInTheDocument();
  });

  it('reports being left, so a form can answer a field on blur', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(
      <>
        <Combobox aria-label="Skill" options={SKILLS} onBlur={onBlur} />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.click(screen.getByRole('combobox', { name: 'Skill' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(onBlur).toHaveBeenCalled();
  });

  it('files options under group headings when the taxonomy needs it', async () => {
    const user = userEvent.setup();
    render(<Combobox aria-label="Skill" options={GROUPED_SKILLS} />);

    await user.click(screen.getByRole('combobox', { name: 'Skill' }));

    const operations = screen.getByRole('group', { name: 'Operations' });
    expect(within(operations).getByRole('option', { name: 'Logistics' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Programme' })).toBeInTheDocument();

    await user.keyboard('logi');

    expect(screen.queryByRole('group', { name: 'Programme' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('opens, arrows, chooses and dismisses from the keyboard alone', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Combobox aria-label="Skill" options={SKILLS} onValueChange={onValueChange} />);
    const combobox = screen.getByRole('combobox', { name: 'Skill' });

    await user.tab();
    expect(combobox).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(highlighted(combobox)).toHaveAccessibleName(MEAL.label);

    await user.keyboard('{ArrowDown}');
    expect(highlighted(combobox)).toHaveAccessibleName('Logistics');

    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('logistics');

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('holds several choices as chips when multiple', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox multiple aria-label="Skills" options={SKILLS} onValueChange={onValueChange} />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Skills' }));
    await user.click(screen.getByRole('option', { name: 'Logistics' }));
    await user.click(screen.getByRole('option', { name: 'Protection' }));

    expect(onValueChange).toHaveBeenLastCalledWith(['logistics', 'protection']);
  });

  it('marks which options are already chosen', async () => {
    const user = userEvent.setup();
    render(<Combobox multiple aria-label="Skills" options={SKILLS} defaultValue={['logistics']} />);

    await user.click(screen.getByRole('combobox', { name: 'Skills' }));

    expect(screen.getByRole('option', { name: 'Logistics' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: 'Protection' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('keeps a value whose option has not arrived yet', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox
        multiple
        aria-label="Skills"
        options={SKILLS}
        value={['logistics', 'nutrition']}
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove nutrition' })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Skills' }));
    await user.click(screen.getByRole('option', { name: 'Protection' }));

    expect(onValueChange).toHaveBeenLastCalledWith(['logistics', 'nutrition', 'protection']);
  });

  it('selects across groups when multiple', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox
        multiple
        aria-label="Skills"
        options={GROUPED_SKILLS}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Skills' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Programme' })).getByRole('option', {
        name: 'Protection',
      }),
    );
    await user.click(
      within(screen.getByRole('group', { name: 'Operations' })).getByRole('option', {
        name: 'Fleet management',
      }),
    );

    expect(onValueChange).toHaveBeenLastCalledWith(['protection', 'fleet']);
  });

  it('drops one chip at a time', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox
        multiple
        aria-label="Skills"
        options={SKILLS}
        defaultValue={['logistics', 'protection']}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove Logistics' }));

    expect(onValueChange).toHaveBeenLastCalledWith(['protection']);
    expect(screen.queryByRole('button', { name: 'Remove Logistics' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Protection' })).toBeInTheDocument();
  });
});
