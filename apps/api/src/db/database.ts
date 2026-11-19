import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema.js';

// Resolves to apps/api/drizzle from both src/db (tests, dev) and dist/db (built app).
const MIGRATIONS_FOLDER = join(import.meta.dirname, '../../drizzle');

export function openDatabase(filename: string) {
  const sqlite = new Database(filename);
  // SQLite leaves foreign keys off unless each connection turns them on.
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

export type AppDatabase = ReturnType<typeof openDatabase>;

/** What queries run against: the database itself, or a transaction opened on it. */
export type DatabaseExecutor = BaseSQLiteDatabase<'sync', Database.RunResult, typeof schema>;
