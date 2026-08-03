import { describe, expect, it } from 'vitest';
import { type Tag, tagChoices, tagToCreate } from './tag';

function tag(name: string): Tag {
  return { id: `id-${name}`, name, scope: 'application', created_at: '2026-07-01T09:00:00Z' };
}

const ARABIC = tag('Arabic');
const DRIVER = tag('Has a driving licence');
const RELOCATING = tag('Relocating');

const VOCABULARY = [ARABIC, DRIVER, RELOCATING];

const names = (query: string, on: Tag[] = []) =>
  tagChoices(VOCABULARY, on, query).map((choice) => choice.name);

describe('the Tenant vocabulary as the picker offers it', () => {
  it('offers the whole vocabulary before anything is typed', () => {
    expect(names('')).toEqual(['Arabic', 'Has a driving licence', 'Relocating']);
  });

  it('keeps the order the API gave, rather than sorting again in the browser', () => {
    expect(tagChoices([RELOCATING, ARABIC], [], '').map((choice) => choice.name)).toEqual([
      'Relocating',
      'Arabic',
    ]);
  });

  it('narrows to what has been typed, wherever in the name it falls', () => {
    expect(names('licence')).toEqual(['Has a driving licence']);
    expect(names('ARAB')).toEqual(['Arabic']);
  });

  it('ignores the spaces around what was typed', () => {
    expect(names('  relocating ')).toEqual(['Relocating']);
  });

  it('says of each Tag whether it is already on the subject', () => {
    expect(tagChoices(VOCABULARY, [DRIVER], '')).toEqual([
      { id: ARABIC.id, name: 'Arabic', isOn: false },
      { id: DRIVER.id, name: 'Has a driving licence', isOn: true },
      { id: RELOCATING.id, name: 'Relocating', isOn: false },
    ]);
  });

  it('offers nothing when the vocabulary has no match', () => {
    expect(names('kurdish')).toEqual([]);
  });
});

describe('the Tag a picker would create from what was typed', () => {
  it('offers to create a name the vocabulary does not have', () => {
    expect(tagToCreate(VOCABULARY, 'Kurdish')).toBe('Kurdish');
  });

  it('offers the name without the spaces it was typed with', () => {
    expect(tagToCreate(VOCABULARY, '  Kurdish  ')).toBe('Kurdish');
  });

  it('offers nothing while nothing has been typed', () => {
    expect(tagToCreate(VOCABULARY, '')).toBeNull();
    expect(tagToCreate(VOCABULARY, '   ')).toBeNull();
  });

  it('offers nothing when the Tenant already has that Tag, whatever the case', () => {
    expect(tagToCreate(VOCABULARY, 'Arabic')).toBeNull();
    expect(tagToCreate(VOCABULARY, 'arabic')).toBeNull();
    expect(tagToCreate(VOCABULARY, ' Relocating ')).toBeNull();
  });

  it('still offers to create a name that only part-matches an existing Tag', () => {
    expect(tagToCreate(VOCABULARY, 'Arab')).toBe('Arab');
  });
});
