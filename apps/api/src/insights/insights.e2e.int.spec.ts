import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { Clock, FixedClock } from '../clock/clock.js';
import { EmployeesService } from '../employees/employees.service.js';
import { createPayFixture } from '../testing/pay-fixture.js';

const NOW = '2026-11-19T10:30:00.000Z';

describe('HTTP API insights', () => {
  const originalDatabasePath = process.env.DATABASE_PATH;
  let app: INestApplication;
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
    createPayFixture(app.get(EmployeesService, { strict: false }));
  });

  afterEach(async () => {
    await app.close();
    if (originalDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = originalDatabasePath;
    }
  });

  it('GET /api/insights/summary returns headcount and the indicative USD payroll', async () => {
    const response = await api().get('/api/insights/summary');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      headcount: 13,
      countryCount: 3,
      departmentCount: 3,
      jobTitleCount: 3,
      payrollUsdMinor: 73_880_000,
      fxTableVersion: '2026-11',
    });
  });

  it('GET /api/insights/countries returns per-country stats in local currency', async () => {
    const response = await api().get('/api/insights/countries');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject([
      { code: 'IN', currency: 'INR', headcount: 6, medianMinor: 110_000_000 },
      { code: 'US', currency: 'USD', headcount: 5, medianMinor: 9_500_000 },
      { code: 'DE', currency: 'EUR', headcount: 2, medianMinor: 7_000_000 },
    ]);
  });

  it('GET /api/insights/countries/:code/job-titles returns the roles and outliers of that country', async () => {
    const response = await api().get('/api/insights/countries/US/job-titles');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      country: { code: 'US', name: 'United States', currency: 'USD' },
      jobTitles: [
        { jobTitle: 'Engineer', headcount: 4, medianMinor: 10_000_000 },
        { jobTitle: 'Account Executive', headcount: 1, medianMinor: 9_000_000 },
      ],
      outliers: [
        { employeeId: 10, fullName: 'Evan Wright', differencePct: 40, direction: 'above' },
        { employeeId: 9, fullName: 'Carla Gomez', differencePct: -30, direction: 'below' },
      ],
    });
  });

  it('GET /api/insights/countries/:code/job-titles answers 400 for an unsupported country', async () => {
    const response = await api().get('/api/insights/countries/ZZ/job-titles');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_INPUT',
        message: 'The input is invalid',
        fields: [{ path: 'code', message: 'Select a supported country' }],
      },
    });
  });

  it('GET /api/employees/:id includes the role median and the employee’s gap from it', async () => {
    const response = await api().get('/api/employees/4');

    expect(response.body).toMatchObject({
      fullName: 'Neha Kapoor',
      roleMedianMinor: 130_000_000,
      pctVsRoleMedian: 53.8,
    });
  });
});
