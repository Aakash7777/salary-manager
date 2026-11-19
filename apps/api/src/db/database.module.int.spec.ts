import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppDatabase } from './database.js';
import { DATABASE, DatabaseModule } from './database.module.js';
import { employees } from './schema.js';

describe('DatabaseModule', () => {
  const originalDatabasePath = process.env.DATABASE_PATH;
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'salary-manager-'));
  });

  afterEach(() => {
    if (originalDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = originalDatabasePath;
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it('opens the database file named by DATABASE_PATH, with migrations applied', async () => {
    const databaseFile = join(directory, 'salaries.db');
    process.env.DATABASE_PATH = databaseFile;

    const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule] }).compile();
    const db = moduleRef.get<AppDatabase>(DATABASE);

    expect(db.select().from(employees).all()).toEqual([]);
    expect(existsSync(databaseFile)).toBe(true);
    await moduleRef.close();
  });

  it('closes the connection when the application shuts down', async () => {
    process.env.DATABASE_PATH = join(directory, 'salaries.db');
    const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule] }).compile();
    const db = moduleRef.get<AppDatabase>(DATABASE);
    expect(db.$client.open).toBe(true);

    await moduleRef.close();

    expect(db.$client.open).toBe(false);
  });
});
