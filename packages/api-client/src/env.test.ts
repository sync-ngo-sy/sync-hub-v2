import { describe, expect, it } from 'vitest';
import { readClientEnv } from './env';

describe('readClientEnv', () => {
  it('accepts an absolute http(s) URL', () => {
    expect(readClientEnv({ VITE_API_BASE_URL: 'https://api.sync.ngo' })).toEqual({
      apiBaseUrl: 'https://api.sync.ngo',
    });
  });

  it('accepts an empty same-origin base', () => {
    expect(readClientEnv({ VITE_API_BASE_URL: '' }).apiBaseUrl).toBe('');
  });

  it('accepts the root-relative base the dev proxy is mounted on', () => {
    expect(readClientEnv({ VITE_API_BASE_URL: '/api' }).apiBaseUrl).toBe('/api');
  });

  it('throws loudly when the base URL is missing', () => {
    expect(() => readClientEnv({})).toThrow(/Invalid frontend environment/);
  });

  it('throws loudly when the base URL is malformed', () => {
    expect(() => readClientEnv({ VITE_API_BASE_URL: 'ftp://nope' })).toThrow(
      /Invalid frontend environment/,
    );
  });

  it('throws loudly on a bare host with no scheme', () => {
    expect(() => readClientEnv({ VITE_API_BASE_URL: 'api.sync.ngo' })).toThrow(
      /Invalid frontend environment/,
    );
  });

  it('rejects a root-relative base that would double the /v1 prefix', () => {
    expect(() => readClientEnv({ VITE_API_BASE_URL: '/v1' })).toThrow(/must not end in \/v1/);
  });

  it('rejects an absolute base that would double the /v1 prefix', () => {
    expect(() => readClientEnv({ VITE_API_BASE_URL: 'https://api.sync.ngo/v1' })).toThrow(
      /must not end in \/v1/,
    );
  });

  it('rejects a /v1 base with a trailing slash', () => {
    expect(() => readClientEnv({ VITE_API_BASE_URL: 'https://api.sync.ngo/v1/' })).toThrow(
      /must not end in \/v1/,
    );
  });

  it('accepts a mount path that merely ends in v1-like characters', () => {
    expect(readClientEnv({ VITE_API_BASE_URL: 'https://api.sync.ngo/apiv1' }).apiBaseUrl).toBe(
      'https://api.sync.ngo/apiv1',
    );
  });
});
