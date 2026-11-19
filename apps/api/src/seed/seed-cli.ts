import { resolveDatabasePath } from '../db/database-path.js';
import { openDatabase } from '../db/database.js';
import { DEFAULT_SEED_OPTIONS, DatabaseNotEmptyError, runSeed } from './run-seed.js';

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

const databasePath = resolveDatabasePath(process.env);
const reset = process.argv.includes('--reset');
const db = openDatabase(databasePath);

try {
  const startedAt = performance.now();
  const report = runSeed(db, { ...DEFAULT_SEED_OPTIONS, reset });
  const elapsedMs = Math.round(performance.now() - startedAt);

  print(`Seeded ${databasePath} in ${elapsedMs} ms`);
  print(`  employees:      ${report.employees}`);
  print(`  salary changes: ${report.salaryChanges}`);
} catch (error) {
  if (!(error instanceof DatabaseNotEmptyError)) {
    throw error;
  }
  print(error.message);
  process.exitCode = 1;
} finally {
  db.$client.close();
}
