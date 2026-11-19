import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { Clock, FixedClock } from '../clock/clock.js';
import { createPayFixture } from '../testing/pay-fixture.js';
import { EmployeesService } from './employees.service.js';

// At 10:30 UTC on the 19th it is already the 20th at UTC+14, so "today" is 2026-11-20.
const NOW = '2026-11-19T10:30:00.000Z';
const BOM = String.fromCharCode(0xfeff);
const HEADER =
  'Name,Email,Job title,Department,Country,Currency,Annual salary,Employment type,Hire date';

describe('HTTP API CSV export', () => {
  const originalDatabasePath = process.env.DATABASE_PATH;
  let app: INestApplication;
  let employees: EmployeesService;
  const api = () => request(app.getHttpServer() as Server);

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(new FixedClock(NOW))
      .compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
    employees = app.get(EmployeesService, { strict: false });
    createPayFixture(employees);
  });

  afterEach(async () => {
    await app.close();
    if (originalDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = originalDatabasePath;
    }
  });

  it('GET /api/employees/export.csv is a CSV download, not mistaken for an employee id', async () => {
    const response = await api().get('/api/employees/export.csv');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="employees-2026-11-20.csv"',
    );
    expect(response.text.startsWith(`${BOM}${HEADER}\r\n`)).toBe(true);
    expect(response.text.split('\r\n').slice(1, -1)).toHaveLength(13);
  });

  it('starts with the three UTF-8 byte order mark bytes and keeps non-English names intact', async () => {
    employees.create({
      fullName: 'Jürgen Müller',
      email: 'juergen.mueller@acme.test',
      jobTitle: 'Engineer',
      department: 'Engineering',
      countryCode: 'DE',
      salaryMajor: 70_000,
      employmentType: 'FULL_TIME',
      hireDate: '2022-01-10',
    });

    const response = await api().get('/api/employees/export.csv').responseType('blob');
    const body = response.body as Buffer;

    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body.toString('utf8')).toContain('Jürgen Müller,juergen.mueller@acme.test');
  });

  it('applies the filters, search and sort from the query string', async () => {
    const response = await api().get(
      '/api/employees/export.csv?country=US&search=o&sort=salary&order=desc',
    );

    // Of the five US employees, Alice Johnson, Brian O'Neil and Carla Gomez contain an "o".
    expect(
      response.text
        .split('\r\n')
        .slice(1, -1)
        .map((line) => line.split(',')[0]),
    ).toEqual(["Brian O'Neil", 'Alice Johnson', 'Carla Gomez']);
  });

  it('escapes a name containing a comma and double quotes', async () => {
    employees.create({
      fullName: 'Sharma, Priya "PJ"',
      email: 'pj.sharma@acme.test',
      jobTitle: 'Engineer',
      department: 'Engineering',
      countryCode: 'SG',
      salaryMajor: 90_000,
      employmentType: 'CONTRACTOR',
      hireDate: '2022-01-10',
    });

    const response = await api().get('/api/employees/export.csv?country=SG');

    expect(response.text).toBe(
      `${BOM}${HEADER}\r\n` +
        '"Sharma, Priya ""PJ""",pj.sharma@acme.test,Engineer,Engineering,Singapore,SGD,90000,Contractor,2022-01-10\r\n',
    );
  });

  it('answers an invalid filter with the usual 400 JSON error, not a CSV', async () => {
    const response = await api().get('/api/employees/export.csv?sort=email');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-disposition']).toBeUndefined();
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_INPUT',
        message: 'The input is invalid',
        fields: [{ path: 'sort', message: 'Sort must be name, salary or hireDate' }],
      },
    });
  });
});
