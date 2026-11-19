import { describe, expect, it } from 'vitest';
import { resolveDatabasePath } from './database-path.js';

describe('resolveDatabasePath', () => {
  it('uses DATABASE_PATH when it is set', () => {
    expect(resolveDatabasePath({ DATABASE_PATH: '/data/salaries.db' })).toBe('/data/salaries.db');
  });

  it('passes :memory: through, for an in-memory database', () => {
    expect(resolveDatabasePath({ DATABASE_PATH: ':memory:' })).toBe(':memory:');
  });

  it.each([
    { env: {}, description: 'unset' },
    { env: { DATABASE_PATH: '' }, description: 'empty' },
    { env: { DATABASE_PATH: '   ' }, description: 'whitespace-only' },
  ])('falls back to salary-manager.db when DATABASE_PATH is $description', ({ env }) => {
    expect(resolveDatabasePath(env)).toBe('salary-manager.db');
  });
});
