import { describe, expect, it } from 'vitest';
import { isClientError, isUnauthorized, problemDetail, problemStatus } from './problem';

describe('problemStatus', () => {
  it('reads the status off a Problem Details rejection', () => {
    expect(problemStatus({ type: 'about:blank', title: 'Not Found', status: 404 })).toBe(404);
  });

  it('is null for anything that carries no status', () => {
    expect(problemStatus(new Error('network down'))).toBeNull();
    expect(problemStatus(undefined)).toBeNull();
  });
});

describe('isClientError', () => {
  it.each([400, 401, 403, 404, 422, 499])('treats %i as the caller’s fault', (status) => {
    expect(isClientError({ status })).toBe(true);
  });

  it.each([500, 502, 503])('treats %i as worth retrying', (status) => {
    expect(isClientError({ status })).toBe(false);
  });

  it('treats an unclassifiable failure as worth retrying', () => {
    expect(isClientError(new Error('fetch failed'))).toBe(false);
  });
});

describe('isUnauthorized', () => {
  it('singles out 401, not the other 4xx', () => {
    expect(isUnauthorized({ status: 401 })).toBe(true);
    expect(isUnauthorized({ status: 403 })).toBe(false);
  });
});

describe('problemDetail', () => {
  it('prefers detail, falls back to title, then to nothing', () => {
    expect(problemDetail({ title: 'Conflict', detail: 'That slug is taken.' })).toBe(
      'That slug is taken.',
    );
    expect(problemDetail({ title: 'Conflict' })).toBe('Conflict');
    expect(problemDetail({})).toBeNull();
  });
});
