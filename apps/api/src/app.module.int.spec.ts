import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { Clock, SystemClock } from './clock/clock.js';
import { EmployeesService } from './employees/employees.service.js';

describe('AppModule', () => {
  const originalDatabasePath = process.env.DATABASE_PATH;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  });

  afterEach(async () => {
    await moduleRef.close();
    if (originalDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = originalDatabasePath;
    }
  });

  it('provides the system clock wherever a Clock is injected', () => {
    expect(moduleRef.get(Clock, { strict: false })).toBeInstanceOf(SystemClock);
  });

  it('wires EmployeesService to the database, so a created employee can be read back', () => {
    const service = moduleRef.get(EmployeesService, { strict: false });

    const created = service.create({
      fullName: 'Priya Sharma',
      email: 'priya.sharma@acme.test',
      jobTitle: 'Senior Engineer',
      department: 'Engineering',
      countryCode: 'IN',
      salaryMajor: 3_240_000,
      employmentType: 'FULL_TIME',
      hireDate: '2024-03-01',
    });

    expect(service.getById(created.id)).toMatchObject({
      email: 'priya.sharma@acme.test',
      currency: 'INR',
      salaryMinor: 324_000_000,
      salaryHistory: [{ reason: 'Starting salary' }],
    });
  });
});
