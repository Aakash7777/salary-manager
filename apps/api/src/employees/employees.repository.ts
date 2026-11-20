import { Inject, Injectable } from '@nestjs/common';
import type { ListEmployeesQuery } from '@salary-manager/shared';
import { and, asc, count, desc, eq, or, sql } from 'drizzle-orm';
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
import { EmailAlreadyInUseError, EmployeeNotFoundError } from './errors.js';

function isDuplicateEmail(error: unknown): boolean {
  // Drizzle may wrap the driver error, so the SQLite error can be the error or its cause.
  for (let current = error; current instanceof Error; current = current.cause) {
    if (current.message.includes('UNIQUE constraint failed: employees.email')) {
      return true;
    }
  }
  return false;
}

// Makes %, _ and \ in user text match themselves in a LIKE pattern that uses ESCAPE '\'.
function escapeLikeWildcards(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
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

  updateEmployee(id: number, changes: Partial<NewEmployeeRow>): EmployeeRow {
    try {
      const updated = this.db
        .update(employees)
        .set(changes)
        .where(eq(employees.id, id))
        .returning()
        .get();
      if (!updated) {
        throw new EmployeeNotFoundError(id);
      }
      return updated;
    } catch (error) {
      if (changes.email !== undefined && isDuplicateEmail(error)) {
        throw new EmailAlreadyInUseError(changes.email);
      }
      throw error;
    }
  }

  /** Returns false when there was no such employee. The salary history goes with it (FK cascade). */
  deleteEmployee(id: number): boolean {
    return this.db.delete(employees).where(eq(employees.id, id)).run().changes > 0;
  }

  insertSalaryChange(change: NewSalaryChangeRow): void {
    this.db.insert(salaryChanges).values(change).run();
  }

  findById(id: number): EmployeeRow | undefined {
    return this.db.select().from(employees).where(eq(employees.id, id)).get();
  }

  findPage(query: ListEmployeesQuery): { items: EmployeeRow[]; total: number } {
    const counted = this.db
      .select({ total: count() })
      .from(employees)
      .where(this.matching(query))
      .get();

    return { items: this.findRows(query), total: counted?.total ?? 0 };
  }

  /** One page of matching employees, without counting them: what a batched export needs. */
  findRows(query: ListEmployeesQuery): EmployeeRow[] {
    // Sorting by salary compares raw minor-unit amounts, so across countries it mixes
    // currencies (INR 1,800,000 sorts above USD 165,000). That is deliberate and kept
    // simple; the UI explains it next to the salary column.
    const sortColumn = {
      name: sql`${employees.fullName} COLLATE NOCASE`,
      salary: employees.salaryMinor,
      hireDate: employees.hireDate,
    }[query.sort];
    const direction = query.order === 'desc' ? desc : asc;

    return (
      this.db
        .select()
        .from(employees)
        .where(this.matching(query))
        // The id tiebreaker keeps rows with equal sort values in one fixed order across pages.
        .orderBy(direction(sortColumn), asc(employees.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .all()
    );
  }

  private matching(query: ListEmployeesQuery) {
    const searchPattern = query.search ? `%${escapeLikeWildcards(query.search)}%` : undefined;
    return and(
      // SQLite's LIKE ignores case for ASCII letters only: "müller" finds "Müller", but
      // "MÜLLER" does not, because Ü and ü are compared as different characters.
      searchPattern
        ? or(
            sql`${employees.fullName} LIKE ${searchPattern} ESCAPE '\\'`,
            sql`${employees.email} LIKE ${searchPattern} ESCAPE '\\'`,
          )
        : undefined,
      query.country ? eq(employees.countryCode, query.country) : undefined,
      query.department ? eq(employees.department, query.department) : undefined,
      query.jobTitle ? eq(employees.jobTitle, query.jobTitle) : undefined,
    );
  }

  /** The pay of every employee the query's search and filters match; its sort and paging are ignored. */
  findPayMatching(query: ListEmployeesQuery): { currency: string; salaryMinor: number }[] {
    return this.db
      .select({ currency: employees.currency, salaryMinor: employees.salaryMinor })
      .from(employees)
      .where(this.matching(query))
      .all();
  }

  /** Salaries of everyone with this job title in this country. */
  findSalariesForRole(countryCode: string, jobTitle: string): number[] {
    return this.db
      .select({ salaryMinor: employees.salaryMinor })
      .from(employees)
      .where(and(eq(employees.countryCode, countryCode), eq(employees.jobTitle, jobTitle)))
      .all()
      .map((row) => row.salaryMinor);
  }

  findDistinctDepartments(): string[] {
    return this.db
      .selectDistinct({ department: employees.department })
      .from(employees)
      .orderBy(asc(employees.department))
      .all()
      .map((row) => row.department);
  }

  findDistinctJobTitles(): string[] {
    return this.db
      .selectDistinct({ jobTitle: employees.jobTitle })
      .from(employees)
      .orderBy(asc(employees.jobTitle))
      .all()
      .map((row) => row.jobTitle);
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
