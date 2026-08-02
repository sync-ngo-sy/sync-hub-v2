import { describe, expect, it } from 'vitest';
import { languageOptions, skillGroups } from './options';

const SKILLS = [
  { name: 'Go', category: 'Programming Languages' },
  { name: 'Python', category: 'Programming Languages' },
  { name: 'Figma', category: 'Design' },
];

const LANGUAGES = [
  { code: 'ar', name: 'Arabic' },
  { code: 'en', name: 'English' },
];

describe('skillGroups', () => {
  it('files every skill under its category, in the order the API answered', () => {
    expect(skillGroups(SKILLS)).toEqual([
      {
        label: 'Programming Languages',
        options: [
          { value: 'Go', label: 'Go' },
          { value: 'Python', label: 'Python' },
        ],
      },
      { label: 'Design', options: [{ value: 'Figma', label: 'Figma' }] },
    ]);
  });

  it('leaves out the skills already taken', () => {
    expect(skillGroups(SKILLS, ['Python'])).toEqual([
      { label: 'Programming Languages', options: [{ value: 'Go', label: 'Go' }] },
      { label: 'Design', options: [{ value: 'Figma', label: 'Figma' }] },
    ]);
  });

  it('drops a category whose every skill is taken, rather than showing an empty heading', () => {
    expect(skillGroups(SKILLS, ['Go', 'Python'])).toEqual([
      { label: 'Design', options: [{ value: 'Figma', label: 'Figma' }] },
    ]);
  });

  it('offers nothing while the taxonomy is still arriving', () => {
    expect(skillGroups(undefined)).toEqual([]);
  });
});

describe('languageOptions', () => {
  it('shows the name and carries the code', () => {
    expect(languageOptions(LANGUAGES)).toEqual([
      { value: 'ar', label: 'Arabic' },
      { value: 'en', label: 'English' },
    ]);
  });

  it('leaves out the languages already taken', () => {
    expect(languageOptions(LANGUAGES, ['ar'])).toEqual([{ value: 'en', label: 'English' }]);
  });

  it('offers nothing while the list is still arriving', () => {
    expect(languageOptions(undefined)).toEqual([]);
  });
});
