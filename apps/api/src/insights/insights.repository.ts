import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../db/database.module.js';
import type { DatabaseExecutor } from '../db/database.js';
import { employees } from '../db/schema.js';

/** The few columns the pay statistics need, so 10,000 rows stay cheap to load. */
export interface PayRow {
  id: number;
  fullName: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  salaryMinor: number;
}

@Injectable()
export class InsightsRepository {
  constructor(@Inject(DATABASE) private readonly db: DatabaseExecutor) {}

  findPayRows(countryCode?: string): PayRow[] {
    return this.db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        jobTitle: employees.jobTitle,
        department: employees.department,
        countryCode: employees.countryCode,
        salaryMinor: employees.salaryMinor,
      })
      .from(employees)
      .where(countryCode === undefined ? undefined : eq(employees.countryCode, countryCode))
      .all();
  }
}
