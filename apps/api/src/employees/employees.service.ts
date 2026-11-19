import { Injectable } from '@nestjs/common';
import { createEmployeeInputSchema, currencyFor, toMinor } from '@salary-manager/shared';
import { Clock } from '../clock/clock.js';
import type { EmployeeRow, SalaryChangeRow } from '../db/schema.js';
import { EmployeesRepository } from './employees.repository.js';
import { EmployeeNotFoundError, InvalidInputError } from './errors.js';

const STARTING_SALARY_REASON = 'Starting salary';

export type EmployeeWithSalaryHistory = EmployeeRow & { salaryHistory: SalaryChangeRow[] };

@Injectable()
export class EmployeesService {
  constructor(
    private readonly repository: EmployeesRepository,
    private readonly clock: Clock,
  ) {}

  create(input: unknown): EmployeeRow {
    const parsed = createEmployeeInputSchema(this.clock.today()).safeParse(input);
    if (!parsed.success) {
      throw new InvalidInputError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }

    const { salaryMajor, ...details } = parsed.data;
    const currency = currencyFor(details.countryCode);
    const salaryMinor = toMinor(salaryMajor, currency);
    const timestamp = this.clock.now().toISOString();

    return this.repository.inTransaction((repository) => {
      const employee = repository.insertEmployee({
        ...details,
        currency,
        salaryMinor,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      repository.insertSalaryChange({
        employeeId: employee.id,
        oldSalaryMinor: null,
        oldCurrency: null,
        newSalaryMinor: salaryMinor,
        currency,
        effectiveDate: employee.hireDate,
        reason: STARTING_SALARY_REASON,
        createdAt: timestamp,
      });
      return employee;
    });
  }

  getById(id: number): EmployeeWithSalaryHistory {
    const employee = this.repository.findById(id);
    if (!employee) {
      throw new EmployeeNotFoundError(id);
    }
    return { ...employee, salaryHistory: this.repository.findSalaryHistory(id) };
  }
}
