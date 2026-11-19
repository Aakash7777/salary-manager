import { Injectable } from '@nestjs/common';
import {
  changeSalaryInputSchema,
  createEmployeeInputSchema,
  currencyFor,
  listEmployeesQuerySchema,
  toMinor,
  updateEmployeeDetailsInputSchema,
} from '@salary-manager/shared';
import { Clock } from '../clock/clock.js';
import type { EmployeeRow, NewEmployeeRow, SalaryChangeRow } from '../db/schema.js';
import { EmployeesRepository } from './employees.repository.js';
import { EmployeeNotFoundError, InvalidInputError } from './errors.js';

const STARTING_SALARY_REASON = 'Starting salary';

export type EmployeeWithSalaryHistory = EmployeeRow & { salaryHistory: SalaryChangeRow[] };

export interface EmployeeListPage {
  items: EmployeeRow[];
  total: number;
  page: number;
  pageSize: number;
}

function invalidInput(issues: { path: PropertyKey[]; message: string }[]): InvalidInputError {
  return new InvalidInputError(
    issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly repository: EmployeesRepository,
    private readonly clock: Clock,
  ) {}

  create(input: unknown): EmployeeRow {
    const parsed = createEmployeeInputSchema(this.clock.today()).safeParse(input);
    if (!parsed.success) {
      throw invalidInput(parsed.error.issues);
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

  list(query: unknown): EmployeeListPage {
    const parsed = listEmployeesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw invalidInput(parsed.error.issues);
    }
    const { items, total } = this.repository.findPage(parsed.data);
    return { items, total, page: parsed.data.page, pageSize: parsed.data.pageSize };
  }

  getById(id: number): EmployeeWithSalaryHistory {
    const employee = this.requireEmployee(id);
    return { ...employee, salaryHistory: this.repository.findSalaryHistory(id) };
  }

  changeSalary(id: number, input: unknown): EmployeeRow {
    const employee = this.requireEmployee(id);
    const parsed = changeSalaryInputSchema(this.clock.today()).safeParse(input);
    if (!parsed.success) {
      throw invalidInput(parsed.error.issues);
    }

    const { newSalaryMajor, effectiveDate, reason } = parsed.data;
    if (effectiveDate < employee.hireDate) {
      throw new InvalidInputError([
        { path: 'effectiveDate', message: 'Effective date cannot be before the hire date' },
      ]);
    }
    const newSalaryMinor = toMinor(newSalaryMajor, employee.currency);
    if (newSalaryMinor === employee.salaryMinor) {
      throw new InvalidInputError([
        {
          path: 'newSalaryMajor',
          message: 'New salary must be different from the current salary',
        },
      ]);
    }

    const timestamp = this.clock.now().toISOString();
    return this.repository.inTransaction((repository) => {
      const updated = repository.updateEmployee(id, {
        salaryMinor: newSalaryMinor,
        updatedAt: timestamp,
      });
      repository.insertSalaryChange({
        employeeId: id,
        oldSalaryMinor: employee.salaryMinor,
        oldCurrency: employee.currency,
        newSalaryMinor,
        currency: employee.currency,
        effectiveDate,
        reason,
        createdAt: timestamp,
      });
      return updated;
    });
  }

  updateDetails(id: number, input: unknown): EmployeeRow {
    const employee = this.requireEmployee(id);
    const parsed = updateEmployeeDetailsInputSchema({
      today: this.clock.today(),
      currentCountryCode: employee.countryCode,
    }).safeParse(input);
    if (!parsed.success) {
      throw invalidInput(parsed.error.issues);
    }

    const { newSalaryMajor, reason, ...details } = parsed.data;
    const changedDetails: Partial<NewEmployeeRow> = Object.fromEntries(
      Object.entries(details).filter(
        ([field, value]) => value !== undefined && value !== employee[field as keyof EmployeeRow],
      ),
    );
    if (Object.keys(changedDetails).length === 0) {
      return employee;
    }

    const timestamp = this.clock.now().toISOString();
    if (changedDetails.countryCode === undefined) {
      return this.repository.updateEmployee(id, { ...changedDetails, updatedAt: timestamp });
    }

    if (newSalaryMajor === undefined || reason === undefined) {
      // The shared schema requires both whenever the country changes.
      throw new Error('A country change reached the service without a new salary and a reason');
    }
    const newCurrency = currencyFor(changedDetails.countryCode);
    const newSalaryMinor = toMinor(newSalaryMajor, newCurrency);

    return this.repository.inTransaction((repository) => {
      const updated = repository.updateEmployee(id, {
        ...changedDetails,
        currency: newCurrency,
        salaryMinor: newSalaryMinor,
        updatedAt: timestamp,
      });
      repository.insertSalaryChange({
        employeeId: id,
        oldSalaryMinor: employee.salaryMinor,
        oldCurrency: employee.currency,
        newSalaryMinor,
        currency: newCurrency,
        effectiveDate: this.clock.today(),
        reason,
        createdAt: timestamp,
      });
      return updated;
    });
  }

  remove(id: number): void {
    if (!this.repository.deleteEmployee(id)) {
      throw new EmployeeNotFoundError(id);
    }
  }

  private requireEmployee(id: number): EmployeeRow {
    const employee = this.repository.findById(id);
    if (!employee) {
      throw new EmployeeNotFoundError(id);
    }
    return employee;
  }
}
