import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { Clock, FixedClock } from './clock/clock.js';
import type { AppDatabase } from './db/database.js';
import { DATABASE } from './db/database.module.js';

// At 10:30 UTC on the 19th it is already the 20th at UTC+14, so "today" is 2026-11-20.
const NOW = '2026-11-19T10:30:00.000Z';
const DAY_AFTER_TODAY = '2026-11-21';

const priyaInput = {
  fullName: 'Priya Sharma',
  email: 'priya.sharma@acme.test',
  jobTitle: 'Senior Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  salaryMajor: 3_240_000,
  employmentType: 'FULL_TIME',
  hireDate: '2024-03-01',
};

const hansInput = {
  fullName: 'Hans Becker',
  email: 'hans.becker@acme.test',
  jobTitle: 'Analyst',
  department: 'Finance',
  countryCode: 'DE',
  salaryMajor: 98_000,
  employmentType: 'FULL_TIME',
  hireDate: '2016-10-03',
};

const priya = {
  id: 1,
  fullName: 'Priya Sharma',
  email: 'priya.sharma@acme.test',
  jobTitle: 'Senior Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  currency: 'INR',
  salaryMinor: 324_000_000,
  employmentType: 'FULL_TIME',
  hireDate: '2024-03-01',
  createdAt: NOW,
  updatedAt: NOW,
};

const priyaStartingSalary = {
  id: 1,
  employeeId: 1,
  oldSalaryMinor: null,
  oldCurrency: null,
  newSalaryMinor: 324_000_000,
  currency: 'INR',
  effectiveDate: '2024-03-01',
  reason: 'Starting salary',
  createdAt: NOW,
};

const promotion = {
  newSalaryMajor: 3_600_000,
  effectiveDate: '2026-11-01',
  reason: 'Promotion to Staff Engineer',
};

const priyaNotFound = {
  error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee 999 was not found' },
};

describe('HTTP API', () => {
  const originalDatabasePath = process.env.DATABASE_PATH;
  let app: INestApplication;
  let loggedErrors: string[];
  const api = () => request(app.getHttpServer() as Server);

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(new FixedClock(NOW))
      .compile();
    app = moduleRef.createNestApplication();
    // Keeps Nest's log lines out of the test output and records what was logged as an error.
    loggedErrors = [];
    app.useLogger({
      log: () => undefined,
      warn: () => undefined,
      error: (message: unknown) => {
        loggedErrors.push(String(message));
      },
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (originalDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = originalDatabasePath;
    }
  });

  describe('happy paths', () => {
    it('POST /api/employees creates an employee and returns it with 201', async () => {
      const response = await api().post('/api/employees').send(priyaInput);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(priya);
    });

    it('returns money as integer salaryMinor plus currency, never a decimal amount', async () => {
      const response = await api()
        .post('/api/employees')
        .send({ ...priyaInput, countryCode: 'US', salaryMajor: 75_000.35 });

      expect(response.body).toMatchObject({ salaryMinor: 7_500_035, currency: 'USD' });
      expect(response.body).not.toHaveProperty('salaryMajor');
    });

    it('GET /api/employees/:id returns the employee with its salary history', async () => {
      await api().post('/api/employees').send(priyaInput);

      const response = await api().get('/api/employees/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...priya,
        salaryHistory: [priyaStartingSalary],
        // Priya is the only Senior Engineer in India, so there is no role median to compare with.
        roleMedianMinor: null,
        pctVsRoleMedian: null,
      });
    });

    it('GET /api/employees returns a page, applying filters, sort and paging from the query string', async () => {
      await api().post('/api/employees').send(priyaInput);
      await api().post('/api/employees').send(hansInput);

      const everyone = await api().get('/api/employees');
      const germansOnly = await api().get(
        '/api/employees?country=DE&sort=salary&order=desc&pageSize=1',
      );

      expect(everyone.status).toBe(200);
      expect(everyone.body).toMatchObject({
        items: [{ fullName: 'Hans Becker' }, { fullName: 'Priya Sharma' }],
        total: 2,
        page: 1,
        pageSize: 25,
      });
      expect(germansOnly.body).toMatchObject({
        items: [{ fullName: 'Hans Becker', salaryMinor: 9_800_000, currency: 'EUR' }],
        total: 1,
        page: 1,
        pageSize: 1,
      });
    });

    it('PATCH /api/employees/:id updates details and returns the employee', async () => {
      await api().post('/api/employees').send(priyaInput);

      const response = await api().patch('/api/employees/1').send({ jobTitle: 'Staff Engineer' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...priya, jobTitle: 'Staff Engineer' });
    });

    it('POST /api/employees/:id/salary-changes changes the salary and records it in history', async () => {
      await api().post('/api/employees').send(priyaInput);

      const response = await api().post('/api/employees/1/salary-changes').send(promotion);
      const afterwards = await api().get('/api/employees/1');

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ ...priya, salaryMinor: 360_000_000 });
      expect(afterwards.body).toMatchObject({
        salaryMinor: 360_000_000,
        salaryHistory: [
          { oldSalaryMinor: 324_000_000, newSalaryMinor: 360_000_000, oldCurrency: 'INR' },
          { reason: 'Starting salary' },
        ],
      });
    });

    it('DELETE /api/employees/:id removes the employee and returns 204 with no body', async () => {
      await api().post('/api/employees').send(priyaInput);

      const response = await api().delete('/api/employees/1');
      const afterwards = await api().get('/api/employees/1');

      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(afterwards.status).toBe(404);
    });

    it('GET /api/meta returns the supported countries and the departments and job titles in use', async () => {
      await api().post('/api/employees').send(priyaInput);
      await api().post('/api/employees').send(hansInput);
      await api()
        .post('/api/employees')
        .send({ ...priyaInput, email: 'rohan.iyer@acme.test', fullName: 'Rohan Iyer' });

      const response = await api().get('/api/meta');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        countries: [
          { code: 'DE', name: 'Germany', currency: 'EUR' },
          { code: 'IN', name: 'India', currency: 'INR' },
          { code: 'SG', name: 'Singapore', currency: 'SGD' },
          { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
          { code: 'US', name: 'United States', currency: 'USD' },
        ],
        departments: ['Engineering', 'Finance'],
        jobTitles: ['Analyst', 'Senior Engineer'],
      });
    });
  });

  describe('400 invalid input', () => {
    it('POST /api/employees returns every field problem in the standard error body', async () => {
      const response = await api()
        .post('/api/employees')
        .send({ ...priyaInput, email: 'not-an-email', salaryMajor: 0 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: 'INVALID_INPUT',
          message: 'The input is invalid',
          fields: [
            { path: 'email', message: 'Enter a valid email address' },
            { path: 'salaryMajor', message: 'Salary must be greater than 0' },
          ],
        },
      });
    });

    it('GET /api/employees rejects an invalid query', async () => {
      const response = await api().get('/api/employees?sort=email');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_INPUT',
          fields: [{ path: 'sort', message: 'Sort must be name, salary or hireDate' }],
        },
      });
    });

    it('PATCH /api/employees/:id refuses a salary, because salary is not editable in "Edit details"', async () => {
      await api().post('/api/employees').send(priyaInput);

      const response = await api().patch('/api/employees/1').send({ salaryMajor: 9_999_999 });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_INPUT',
          fields: [{ path: '', message: 'Unrecognized key: "salaryMajor"' }],
        },
      });
    });

    it('POST /api/employees/:id/salary-changes rejects a salary change dated in the future', async () => {
      await api().post('/api/employees').send(priyaInput);

      const response = await api()
        .post('/api/employees/1/salary-changes')
        .send({ ...promotion, effectiveDate: DAY_AFTER_TODAY });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_INPUT',
          fields: [{ path: 'effectiveDate', message: 'Effective date cannot be in the future' }],
        },
      });
    });

    it.each(['abc', '1.5'])('rejects the non-numeric employee id "%s"', async (id) => {
      const response = await api().get(`/api/employees/${id}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: 'INVALID_INPUT',
          message: 'The input is invalid',
          fields: [{ path: 'id', message: 'Employee id must be a whole number' }],
        },
      });
    });

    it('answers a malformed JSON body in the standard error body', async () => {
      const response = await api()
        .post('/api/employees')
        .set('Content-Type', 'application/json')
        .send('{ "fullName": ');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: { code: 'BAD_REQUEST', message: expect.any(String) as string },
      });
    });
  });

  describe('404 not found', () => {
    it('GET /api/employees/:id returns the standard error body, without a fields list', async () => {
      const response = await api().get('/api/employees/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual(priyaNotFound);
    });

    it('PATCH, DELETE and salary-changes all answer 404 for an unknown employee', async () => {
      const patched = await api().patch('/api/employees/999').send({ jobTitle: 'Staff Engineer' });
      const deleted = await api().delete('/api/employees/999');
      const changed = await api().post('/api/employees/999/salary-changes').send(promotion);

      expect([patched.status, deleted.status, changed.status]).toEqual([404, 404, 404]);
      expect([patched.body, deleted.body, changed.body]).toEqual([
        priyaNotFound,
        priyaNotFound,
        priyaNotFound,
      ]);
    });

    it('answers an unknown route in the standard error body', async () => {
      const response = await api().get('/api/nope');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: expect.any(String) as string },
      });
    });
  });

  describe('409 conflict', () => {
    const emailInUse = {
      error: {
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'An employee with the email priya.sharma@acme.test already exists',
      },
    };

    it('POST /api/employees rejects an email that is already in use', async () => {
      await api().post('/api/employees').send(priyaInput);

      const response = await api().post('/api/employees').send(priyaInput);

      expect(response.status).toBe(409);
      expect(response.body).toEqual(emailInUse);
    });

    it('PATCH /api/employees/:id rejects changing the email to one already in use', async () => {
      await api().post('/api/employees').send(priyaInput);
      await api().post('/api/employees').send(hansInput);

      const response = await api()
        .patch('/api/employees/2')
        .send({ email: 'priya.sharma@acme.test' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual(emailInUse);
    });
  });

  describe('500 unexpected error', () => {
    it('answers with a generic message and does not leak the internal error', async () => {
      app.get<AppDatabase>(DATABASE).$client.exec(`
        CREATE TRIGGER fail_history_insert BEFORE INSERT ON salary_changes
        BEGIN SELECT RAISE(ABORT, 'history insert failed'); END;
      `);

      const response = await api().post('/api/employees').send(priyaInput);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      });
      expect(response.text).not.toContain('history insert failed');
      expect(response.text).not.toContain('salary_changes');
    });

    it('logs the real error on the server, so it is not lost', async () => {
      app.get<AppDatabase>(DATABASE).$client.exec(`
        CREATE TRIGGER fail_history_insert BEFORE INSERT ON salary_changes
        BEGIN SELECT RAISE(ABORT, 'history insert failed'); END;
      `);

      await api().post('/api/employees').send(priyaInput);

      expect(loggedErrors).toHaveLength(1);
      expect(loggedErrors[0]).toContain('history insert failed');
    });

    it('does not log an expected error such as a 404 as a server error', async () => {
      await api().get('/api/employees/999');

      expect(loggedErrors).toEqual([]);
    });
  });
});
