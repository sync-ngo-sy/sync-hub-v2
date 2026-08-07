import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(import.meta.dirname, '.');

const FORBIDDEN = [
  /from ['"]@sync\/api-client/,
  /from ['"]@tanstack\/react-query/,
  /from ['"]openapi-/,
  /\bfetch\s*\(/,
];

function shippedSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'testing' ? [] : shippedSources(path);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('the design system', () => {
  it('fetches nothing and never imports the API client', () => {
    const offenders = shippedSources(SOURCE_ROOT).filter((path) => {
      const source = readFileSync(path, 'utf8');
      return FORBIDDEN.some((pattern) => pattern.test(source));
    });

    expect(offenders).toEqual([]);
  });
});
