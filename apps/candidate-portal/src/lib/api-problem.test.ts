import { describe, expect, it } from 'vitest';
import { isClientError, isProblem, problemMessage, problemStatus } from './api-problem';

const NOT_AUTHENTICATED = {
  type: 'urn:sync:problem:not-authenticated',
  title: 'Unauthorized',
  status: 401,
  detail: 'Sign in to continue.',
};

describe('problemStatus', () => {
  it('reads the status the API repeats inside the problem body', () => {
    expect(problemStatus(NOT_AUTHENTICATED)).toBe(401);
  });

  it('has no status to report when the request never reached the API', () => {
    expect(problemStatus(new TypeError('Failed to fetch'))).toBeNull();
    expect(problemStatus(undefined)).toBeNull();
  });
});

describe('isClientError', () => {
  it('recognises the statuses a retry could never fix', () => {
    expect(isClientError({ ...NOT_AUTHENTICATED, status: 401 })).toBe(true);
    expect(isClientError({ ...NOT_AUTHENTICATED, status: 404 })).toBe(true);
    expect(isClientError({ ...NOT_AUTHENTICATED, status: 422 })).toBe(true);
  });

  it('leaves server faults and transport failures retryable', () => {
    expect(isClientError({ ...NOT_AUTHENTICATED, status: 500 })).toBe(false);
    expect(isClientError({ ...NOT_AUTHENTICATED, status: 502 })).toBe(false);
    expect(isClientError(new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('isProblem', () => {
  it('recognises the problem type the caller is looking for', () => {
    expect(isProblem(NOT_AUTHENTICATED, 'urn:sync:problem:not-authenticated')).toBe(true);
  });

  it('does not confuse it with another problem, or with a transport failure', () => {
    expect(isProblem(NOT_AUTHENTICATED, 'urn:sync:problem:invalid-email-token')).toBe(false);
    expect(isProblem(new TypeError('Failed to fetch'), 'urn:sync:problem:not-authenticated')).toBe(
      false,
    );
  });
});

describe('problemMessage', () => {
  it('prefers the occurrence-specific detail', () => {
    expect(problemMessage(NOT_AUTHENTICATED, 'Something went wrong.')).toBe('Sign in to continue.');
  });

  it('falls back to the problem type summary when there is no detail', () => {
    expect(problemMessage({ ...NOT_AUTHENTICATED, detail: null }, 'Something went wrong.')).toBe(
      'Unauthorized',
    );
  });

  it("falls back to the caller's wording when the failure carries no problem body", () => {
    expect(problemMessage(new TypeError('Failed to fetch'), 'Something went wrong.')).toBe(
      'Something went wrong.',
    );
  });
});
