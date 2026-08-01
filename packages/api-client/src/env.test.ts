import { describe, expect, it } from 'vitest';
import { readClientEnv } from './env';

describe('readClientEnv', () => {
  it('returns the configured API base', () => {
    expect(readClientEnv({ VITE_API_BASE_URL: 'https://api.sync.test' })).toEqual({
      apiBaseUrl: 'https://api.sync.test',
    });
  });

  it('throws when the API base is absent', () => {
    expect(() => readClientEnv({})).toThrow(/VITE_API_BASE_URL/);
  });

  it.each([
    ['', 'same-origin'],
    ['/api', 'a dev-proxy mount point'],
    ['http://localhost:8000', 'the local backend'],
  ])('accepts %j as %s', (value) => {
    expect(readClientEnv({ VITE_API_BASE_URL: value })).toEqual({ apiBaseUrl: value });
  });

  it.each([
    'not-a-url',
    'ftp://api.sync.test',
    '//evil.test',
  ])('rejects %j, which is neither a root-relative path nor an http(s) URL', (value) => {
    expect(() => readClientEnv({ VITE_API_BASE_URL: value })).toThrow(/VITE_API_BASE_URL/);
  });

  it.each([
    'https://api.sync.test/v1',
    'https://api.sync.test/v1/',
    '/api/v1',
  ])('rejects %s, whose path already carries the /v1 the generated paths add', (value) => {
    expect(() => readClientEnv({ VITE_API_BASE_URL: value })).toThrow(/\/v1/);
  });
});
