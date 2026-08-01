import type { components } from '@sync/api-client';
import { describe, expect, it } from 'vitest';
import { applicationRejection } from './rejection';

type SubmissionRefused = components['schemas']['SubmissionRefusedProblemDetail'];
type NewApplication = components['schemas']['NewApplication'];

const ANSWERS: NonNullable<NewApplication['answers']> = [
  {
    question_id: '00000000-0000-4000-8000-000000000201',
    answer_boolean: true,
  },
];

function refused(
  errors: NonNullable<SubmissionRefused['errors']>,
  detail = 'The answers do not match the questions this job asks.',
): SubmissionRefused {
  return {
    type: 'urn:sync:problem:invalid-application-answers',
    title: 'Unprocessable Entity',
    status: 422,
    detail,
    errors,
  };
}

describe('a rejected Application', () => {
  it('puts an indexed answer failure back on the question that produced it', () => {
    const rejection = applicationRejection(
      refused([
        {
          location: 'body.answers.0.answer_boolean',
          message: 'This answer no longer matches the question.',
          type: 'answer_type_mismatch',
        },
      ]),
      ANSWERS,
    );

    expect(rejection.fields).toEqual([
      {
        name: 'answers.00000000-0000-4000-8000-000000000201',
        message: 'This answer no longer matches the question.',
      },
    ]);
    expect(rejection.root).toBeNull();
  });

  it('speaks for the form when the rejection cannot name a visible question', () => {
    const rejection = applicationRejection(
      refused([
        {
          location: 'body.answers',
          message: 'A newly required question is unanswered.',
          type: 'missing_required_answer',
        },
      ]),
      ANSWERS,
    );

    expect(rejection.fields).toEqual([]);
    expect(rejection.root).toBe('The answers do not match the questions this job asks.');
  });

  it('keeps conflicts and failures without located fields at the form root', () => {
    expect(
      applicationRejection(
        {
          type: 'urn:sync:problem:application-already-exists',
          title: 'Conflict',
          status: 409,
          detail: 'You have already applied to this job.',
        },
        ANSWERS,
      ),
    ).toEqual({ fields: [], root: 'You have already applied to this job.' });
  });
});
