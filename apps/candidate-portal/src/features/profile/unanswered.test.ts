import type { FieldErrors } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { ProfileFormValues } from './schemas/profile';
import { whatIsUnanswered } from './unanswered';

const errors = (fields: Record<string, unknown>) => fields as FieldErrors<ProfileFormValues>;

const said = (message: string) => ({ type: 'custom', message });

describe('what is unanswered', () => {
  it('repeats the one message when a single place is at fault', () => {
    expect(whatIsUnanswered(errors({ skills: said('Add a skill, or turn the switch off.') }))).toBe(
      'Your profile was not saved. Add a skill, or turn the switch off.',
    );
  });

  it('names every place in the order the page reads', () => {
    expect(
      whatIsUnanswered(
        errors({
          languages: said('Add a language.'),
          skills: said('Add a skill.'),
          educations: said('Add a qualification.'),
        }),
      ),
    ).toBe('Your profile was not saved. Still to do: Education, Skills and Languages.');
  });

  it('names a place once when two of its fields are at fault', () => {
    expect(
      whatIsUnanswered(
        errors({
          phone: said('Enter a number Syria can dial.'),
          phone_country: said('Choose it.'),
        }),
      ),
    ).toBe('Your profile was not saved. Enter a number Syria can dial.');
  });

  it('names the section an unfinished entry sits in, rather than the red fields', () => {
    expect(whatIsUnanswered(errors({ skills: [{ name: said('Choose a skill.') }] }))).toBe(
      'Your profile was not saved. Still to do: Skills.',
    );
  });

  it('names a section whose entries are at fault, without a message of its own', () => {
    expect(
      whatIsUnanswered(
        errors({
          experiences: [{ start_year: said('Enter the year.') }],
          skills: [{ name: said('Choose a skill.') }],
        }),
      ),
    ).toBe('Your profile was not saved. Still to do: Experience and Skills.');
  });

  it('falls back to the red fields when it can name no place at all', () => {
    expect(whatIsUnanswered(errors({}))).toBe(
      'Your profile was not saved. Look for the fields marked in red.',
    );
  });
});
