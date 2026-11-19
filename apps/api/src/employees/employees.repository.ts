import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DATABASE } from '../db/database.module.js';
import type { DatabaseExecutor } from '../db/database.js';
import {
  type EmployeeRow,
  type NewEmployeeRow,
  type NewSalaryChangeRow,
  type SalaryChangeRow,
  employees,
  salaryChanges,
} from '../db/schema.js';
import { EmailAlreadyInUseError } from './errors.js';

function isDuplicateEmail(error: unknown): boolean {
  // Drizzle may wrap the driver error, so the SQLite error can be the error or its cause.
  for (let current = error; current instanceof Error; current = current.cause) {
    if (current.message.includes('UNIQUE constraint failed: employees.email')) {
      return true;
    }
  }
  return false;
}

@Injectable()
export class EmployeesRepository {
  constructor(@Inject(DATABASE) private readonly db: DatabaseExecutor) {}

  inTransaction<T>(work: (repository: EmployeesRepository) => T): T {
    return this.db.transaction((transaction) => work(new EmployeesRepository(transaction)));
  }

  insertEmployee(employee: NewEmployeeRow): EmployeeRow {
    try {
      return this.db.insert(employees).values(employee).returning().get();
    } catch (error) {
      if (isDuplicateEmail(error)) {
        throw new EmailAlreadyInUseError(employee.email);
      }
      throw error;
    }
  }

  insertSalaryChange(change: NewSalaryChangeRow): void {
    this.db.insert(salaryChanges).values(change).run();
  }

  findById(id: number): EmployeeRow | undefined {
    return this.db.select().from(employees).where(eq(employees.id, id)).get();
  }

  findSalaryHistory(employeeId: number): SalaryChangeRow[] {
    return this.db
      .select()
      .from(salaryChanges)
      .where(eq(salaryChanges.employeeId, employeeId))
      .orderBy(desc(salaryChanges.effectiveDate), desc(salaryChanges.id))
      .all();
  }
}
