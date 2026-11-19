import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type AppDatabase, openDatabase } from './database.js';
import { employees } from './schema.js';

describe('openDatabase', () => {
  let directory: string;
  let db: AppDatabase | undefined;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'salary-manager-open-'));
    db = undefined;
  });

  afterEach(() => {
    db?.$client.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('creates the missing parent directories of the database file, however deep', () => {
    const databaseFile = join(directory, 'not-there-yet', 'nor-this', 'salaries.db');

    db = openDatabase(databaseFile);

    expect(existsSync(databaseFile)).toBe(true);
    expect(db.select().from(employees).all()).toEqual([]);
  });

  it('opens a database in a directory that already exists', () => {
    const databaseFile = join(directory, 'salaries.db');

    db = openDatabase(databaseFile);

    expect(existsSync(databaseFile)).toBe(true);
  });

  it('creates nothing on disk for an in-memory database', () => {
    const before = readdirSync(process.cwd()).sort();

    db = openDatabase(':memory:');

    expect(db.select().from(employees).all()).toEqual([]);
    expect(readdirSync(process.cwd()).sort()).toEqual(before);
  });
});
