import type { components } from '@sync/api-client';
import { describe, expect, it } from 'vitest';
import { SEARCHABLE_NEEDS_CV } from '@/testing/fixtures';
import { profileRejection } from './rejection';

type ValidationProblem = components['schemas']['ValidationProblemDetail'];

function refused(errors: ValidationProblem['errors'], type = 'urn:sync:problem:validation-error') {
  return {
    type,
    title: 'Unprocessable Entity',
    status: 422,
    detail: 'The request did not match the expected shape.',
    errors,
  } satisfies ValidationProblem;
}

describe('a rejected profile', () => {
  it('puts an identity field back where the candidate typed it', () => {
    const rejection = profileRejection(
      refused([{ location: 'body.full_name', message: 'too long', type: 'string_too_long' }]),
    );

    expect(rejection?.fields).toEqual([{ name: 'full_name', message: 'too long' }]);
    expect(rejection?.root).toBeNull();
  });

  it('follows the API from a located entry to the same entry in the form', () => {
    const rejection = profileRejection(
      refused(
        [
          {
            location: 'body.skills.2.name',
            message: '“Pythonn” is not a Canonical skill.',
            type: 'unknown_canonical_skill',
          },
          {
            location: 'body.languages.0.code',
            message: '“zz” is not a language the platform knows.',
            type: 'unknown_language',
          },
          {
            location: 'body.experiences.1.end_year',
            message: 'the end of a period cannot come before its start',
            type: 'value_error',
          },
        ],
        'urn:sync:problem:unknown-canonical-skill',
      ),
    );

    expect(rejection?.fields).toEqual([
      { name: 'skills.2.name', message: '“Pythonn” is not a Canonical skill.' },
      { name: 'languages.0.code', message: '“zz” is not a language the platform knows.' },
      {
        name: 'experiences.1.end_year',
        message: 'the end of a period cannot come before its start',
      },
    ]);
  });

  it('lands a rejected unmapped skill on the input that holds it', () => {
    const rejection = profileRejection(
      refused([
        { location: 'body.unmapped_skills.3', message: 'too long', type: 'string_too_long' },
      ]),
    );

    expect(rejection?.fields).toEqual([{ name: 'unmapped_skills.3.value', message: 'too long' }]);
  });

  it('speaks for the whole form when a rejection names no field the form has', () => {
    const rejection = profileRejection(
      refused([
        { location: 'body.skills', message: 'list should have at most 50 items', type: 'too_long' },
        { location: 'query.debug', message: 'extra inputs are not permitted', type: 'extra' },
      ]),
    );

    expect(rejection?.fields).toEqual([]);
    expect(rejection?.root).toBe('The request did not match the expected shape.');
  });

  it('still speaks for the form when only some of a rejection could be placed', () => {
    const rejection = profileRejection(
      refused([
        { location: 'body.full_name', message: 'too long', type: 'string_too_long' },
        { location: 'body.skills', message: 'list should have at most 50 items', type: 'too_long' },
      ]),
    );

    expect(rejection?.fields).toEqual([{ name: 'full_name', message: 'too long' }]);
    expect(rejection?.root).toBe('The request did not match the expected shape.');
  });

  it('falls back to its own wording when the rejection explains nothing', () => {
    const rejection = profileRejection({
      type: 'urn:sync:problem:validation-error',
      title: '',
      status: 422,
      errors: [],
    });

    expect(rejection?.fields).toEqual([]);
    expect(rejection?.root).toBe("Your profile couldn't be saved.");
  });

  it('blames the searchable switch when Global search needs a CV first', () => {
    const rejection = profileRejection(SEARCHABLE_NEEDS_CV);

    expect(rejection?.fields).toEqual([
      { name: 'is_searchable', message: SEARCHABLE_NEEDS_CV.detail },
    ]);
    expect(rejection?.root).toBeNull();
  });

  it('leaves a failure the form cannot show to the caller', () => {
    expect(
      profileRejection({ type: 'about:blank', title: 'Internal Server Error', status: 500 }),
    ).toBeNull();
    expect(
      profileRejection({
        type: 'urn:sync:problem:rate-limited',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many requests from this address.',
      }),
    ).toBeNull();
    expect(profileRejection(new TypeError('Failed to fetch'))).toBeNull();
  });
});
