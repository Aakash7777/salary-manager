import { type AppDatabase, openDatabase } from './database.js';

export function createTestDb(): AppDatabase {
  return openDatabase(':memory:');
}
