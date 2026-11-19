import { describe, expect, it } from 'vitest';
import { createTestDb } from './create-test-db.js';
import { employees, salaryChanges } from './schema.js';

type TestDb = ReturnType<typeof createTestDb>;

const priya = {
  fullName: 'Priya Sharma',
  email: 'priya.sharma@acme.test',
  jobTitle: 'Senior Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  currency: 'INR',
  salaryMinor: 324_000_000,
  employmentType: 'FULL_TIME',
  hireDate: '2024-03-01',
  createdAt: '2026-11-19T10:00:00.000Z',
  updatedAt: '2026-11-19T10:00:00.000Z',
};

function startingSalaryFor(employeeId: number) {
  return {
    employeeId,
    oldSalaryMinor: null,
    oldCurrency: null,
    newSalaryMinor: 324_000_000,
    currency: 'INR',
    effectiveDate: '2024-03-01',
    reason: 'Starting salary',
    createdAt: '2026-11-19T10:00:00.000Z',
  };
}

function insertPriya(db: TestDb): number {
  return Number(db.insert(employees).values(priya).run().lastInsertRowid);
}

function indexedColumnsOf(db: TestDb, table: string): { columns: string; unique: boolean }[] {
  const indexes = db.$client.prepare(`PRAGMA index_list('${table}')`).all() as {
    name: string;
    unique: number;
  }[];

  return indexes.map((index) => {
    const columns = db.$client.prepare(`PRAGMA index_info('${index.name}')`).all() as {
      name: string;
    }[];
    return { columns: columns.map((column) => column.name).join(','), unique: index.unique === 1 };
  });
}

describe('createTestDb', () => {
  it('returns a migrated database whose tables are empty', () => {
    const db = createTestDb();

    expect(db.select().from(employees).all()).toEqual([]);
    expect(db.select().from(salaryChanges).all()).toEqual([]);
  });

  it('gives every caller its own isolated database', () => {
    const first = createTestDb();
    const second = createTestDb();

    insertPriya(first);

    expect(first.select().from(employees).all()).toHaveLength(1);
    expect(second.select().from(employees).all()).toEqual([]);
  });

  it('stores and returns an employee row with integer minor-unit salary', () => {
    const db = createTestDb();

    const id = insertPriya(db);

    expect(db.select().from(employees).all()).toEqual([{ id, ...priya }]);
  });

  it('stores a starting-salary history row that has no old salary and no old currency', () => {
    const db = createTestDb();
    const employeeId = insertPriya(db);

    db.insert(salaryChanges).values(startingSalaryFor(employeeId)).run();

    expect(db.select().from(salaryChanges).all()).toEqual([
      { id: 1, ...startingSalaryFor(employeeId) },
    ]);
  });

  it('stores a normal salary change with the old currency equal to the currency', () => {
    const db = createTestDb();
    const raise = {
      employeeId: insertPriya(db),
      oldSalaryMinor: 324_000_000,
      oldCurrency: 'INR',
      newSalaryMinor: 360_000_000,
      currency: 'INR',
      effectiveDate: '2026-11-01',
      reason: 'Promotion to Staff Engineer',
      createdAt: '2026-11-19T10:00:00.000Z',
    };

    db.insert(salaryChanges).values(raise).run();

    expect(db.select().from(salaryChanges).all()).toEqual([{ id: 1, ...raise }]);
  });

  it('stores a country change with the old salary kept in its previous currency', () => {
    const db = createTestDb();
    const relocation = {
      employeeId: insertPriya(db),
      oldSalaryMinor: 324_000_000,
      oldCurrency: 'INR',
      newSalaryMinor: 8_500_000,
      currency: 'EUR',
      effectiveDate: '2026-11-19',
      reason: 'Relocated to Berlin',
      createdAt: '2026-11-19T10:00:00.000Z',
    };

    db.insert(salaryChanges).values(relocation).run();

    expect(db.select().from(salaryChanges).all()).toEqual([{ id: 1, ...relocation }]);
  });

  it('creates the employee indexes listed in the architecture', () => {
    const db = createTestDb();

    expect(indexedColumnsOf(db, 'employees')).toEqual(
      expect.arrayContaining([
        { columns: 'country_code,job_title', unique: false },
        { columns: 'department', unique: false },
        { columns: 'full_name', unique: false },
        { columns: 'email', unique: true },
      ]),
    );
  });

  it('indexes salary changes by employee, for the history lookup', () => {
    const db = createTestDb();

    expect(indexedColumnsOf(db, 'salary_changes')).toEqual(
      expect.arrayContaining([{ columns: 'employee_id', unique: false }]),
    );
  });

  it('rejects a second employee with the same email', () => {
    const db = createTestDb();
    insertPriya(db);

    expect(() => insertPriya(db)).toThrow('UNIQUE constraint failed: employees.email');
  });

  it('rejects a salary change for an employee that does not exist', () => {
    const db = createTestDb();

    expect(() => db.insert(salaryChanges).values(startingSalaryFor(999)).run()).toThrow(
      'FOREIGN KEY constraint failed',
    );
  });

  it('deletes the salary history together with its employee', () => {
    const db = createTestDb();
    const employeeId = insertPriya(db);
    db.insert(salaryChanges).values(startingSalaryFor(employeeId)).run();

    db.delete(employees).run();

    expect(db.select().from(salaryChanges).all()).toEqual([]);
  });
});
