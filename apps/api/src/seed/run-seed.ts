import { count } from 'drizzle-orm';
import type { AppDatabase } from '../db/database.js';
import { employees } from '../db/schema.js';
import { type SeedOptions, type SeedReport, seedDatabase } from './seed-database.js';

export const DEFAULT_SEED_OPTIONS: SeedOptions = {
  count: 10_000,
  seed: 20_261_119,
  referenceDate: '2026-11-01',
};

export class DatabaseNotEmptyError extends Error {
  constructor(readonly existingEmployees: number) {
    super(
      `The database already has ${existingEmployees} employees. Pass --reset to delete them and seed again.`,
    );
    this.name = 'DatabaseNotEmptyError';
  }
}

export function runSeed(db: AppDatabase, options: SeedOptions & { reset: boolean }): SeedReport {
  const existing = db.select({ total: count() }).from(employees).get()?.total ?? 0;
  if (existing > 0 && !options.reset) {
    throw new DatabaseNotEmptyError(existing);
  }
  if (existing > 0) {
    // Their salary history goes with them (foreign key cascade).
    db.delete(employees).run();
    // SQLite remembers the highest id each AUTOINCREMENT table has used. Forgetting it makes
    // ids start at 1 again, so a reseeded database matches a freshly seeded one exactly.
    db.$client.exec("DELETE FROM sqlite_sequence WHERE name IN ('employees', 'salary_changes')");
  }
  return seedDatabase(db, options);
}
