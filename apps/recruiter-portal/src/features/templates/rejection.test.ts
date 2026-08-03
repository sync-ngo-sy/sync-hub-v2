import type { components } from '@sync/api-client';
import { describe, expect, it } from 'vitest';
import { messageTemplateRejection } from './rejection';

function refused(errors: components['schemas']['InvalidField'][]) {
  return {
    type: 'urn:sync:problem:validation-error',
    title: 'Invalid request',
    status: 422,
    detail: 'One field needs attention.',
    errors,
  };
}

describe('a refused Message template save', () => {
  it('lands each named field beneath the field the form renders', () => {
    const rejection = messageTemplateRejection(
      refused([
        { location: 'body.name', message: 'Pick a shorter name.', type: 'value_error' },
        { location: 'body.subject', message: 'Nothing fills that.', type: 'value_error' },
        { location: 'body.body', message: 'Say more than that.', type: 'value_error' },
      ]),
    );

    expect(rejection.fields).toEqual([
      { name: 'name', message: 'Pick a shorter name.' },
      { name: 'subject', message: 'Nothing fills that.' },
      { name: 'body', message: 'Say more than that.' },
    ]);
    expect(rejection.root).toBeNull();
  });

  it('lands a name already taken by another template on the name field', () => {
    const rejection = messageTemplateRejection({
      type: 'urn:sync:problem:message-template-name-taken',
      title: 'Conflict',
      status: 409,
      detail: 'This tenant already has a message template called “Interview invitation”.',
    });

    expect(rejection.fields).toEqual([
      {
        name: 'name',
        message: 'This tenant already has a message template called “Interview invitation”.',
      },
    ]);
    expect(rejection.root).toBeNull();
  });

  it('keeps a field it cannot show at the form root, with the ones it can', () => {
    const rejection = messageTemplateRejection(
      refused([
        { location: 'body.name', message: 'Pick a shorter name.', type: 'value_error' },
        { location: 'query.limit', message: 'Not a number.', type: 'int_parsing' },
      ]),
    );

    expect(rejection.fields).toEqual([{ name: 'name', message: 'Pick a shorter name.' }]);
    expect(rejection.root).toBe('One field needs attention.');
  });

  it('says something at the root when the refusal names no field at all', () => {
    const rejection = messageTemplateRejection(new TypeError('Failed to fetch'));

    expect(rejection.fields).toEqual([]);
    expect(rejection.root).toBe("This template couldn't be saved.");
  });
});
