import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const employees = sqliteTable(
  'employees',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    jobTitle: text('job_title').notNull(),
    department: text('department').notNull(),
    countryCode: text('country_code').notNull(),
    currency: text('currency').notNull(),
    salaryMinor: integer('salary_minor').notNull(),
    employmentType: text('employment_type').notNull(),
    hireDate: text('hire_date').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('employees_email_unique').on(table.email),
    index('employees_country_code_job_title_idx').on(table.countryCode, table.jobTitle),
    index('employees_department_idx').on(table.department),
    // The directory sorts names ignoring case, and SQLite only uses an index for an ORDER BY
    // whose collation matches the index's.
    index('employees_full_name_idx').on(sql`${table.fullName} COLLATE NOCASE`),
  ],
);

export const salaryChanges = sqliteTable(
  'salary_changes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    // Both "old" columns are null only on the "Starting salary" row.
    oldSalaryMinor: integer('old_salary_minor'),
    // Differs from `currency` only when the change came from a country change.
    oldCurrency: text('old_currency'),
    newSalaryMinor: integer('new_salary_minor').notNull(),
    currency: text('currency').notNull(),
    effectiveDate: text('effective_date').notNull(),
    reason: text('reason').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('salary_changes_employee_id_idx').on(table.employeeId)],
);

export type EmployeeRow = typeof employees.$inferSelect;
export type NewEmployeeRow = typeof employees.$inferInsert;
export type SalaryChangeRow = typeof salaryChanges.$inferSelect;
export type NewSalaryChangeRow = typeof salaryChanges.$inferInsert;
