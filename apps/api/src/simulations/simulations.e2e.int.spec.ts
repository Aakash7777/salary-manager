import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { Clock, FixedClock } from '../clock/clock.js';
import type { AppDatabase } from '../db/database.js';
import { DATABASE } from '../db/database.module.js';
import { EmployeesService } from '../employees/employees.service.js';
import { createPayFixture } from '../testing/pay-fixture.js';

const NOW = '2026-11-19T10:30:00.000Z';

describe('HTTP API raise simulator', () => {
  const originalDatabasePath = process.env.DATABASE_PATH;
  let app: INestApplication;
  const api = () => request(app.getHttpServer() as Server);

  /** Everything stored, plus SQLite's own count of rows written on this connection. */
  function databaseState() {
    const db = app.get<AppDatabase>(DATABASE, { strict: false });
    return {
      employees: db.$client.prepare('SELECT * FROM employees ORDER BY id').all(),
      salaryChanges: db.$client.prepare('SELECT * FROM salary_changes ORDER BY id').all(),
      rowsWritten: db.$client.prepare('SELECT total_changes() AS total').get(),
    };
  }

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

  it('POST /api/simulations/raise returns the cost per currency, the matched headcount and the indicative USD total', async () => {
    const response = await api()
      .post('/api/simulations/raise')
      .send({ filters: { country: 'IN', jobTitle: 'Engineer' }, pct: 8 });

    // 200, not 201: nothing is created.
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      headcount: 4,
      byCurrency: [
        {
          currency: 'INR',
          headcount: 4,
          currentTotalMinor: 560_000_000,
          increaseMinor: 44_800_000,
          newTotalMinor: 604_800_000,
        },
      ],
      increaseUsdMinor: 537_600,
      fxTableVersion: '2026-11',
    });
  });

  it('POST /api/simulations/raise with no filters covers every employee, one row per currency', async () => {
    const response = await api().post('/api/simulations/raise').send({ pct: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      headcount: 13,
      byCurrency: [
        { currency: 'EUR', headcount: 2, increaseMinor: 1_400_000 },
        { currency: 'INR', headcount: 6, increaseMinor: 73_000_000 },
        { currency: 'USD', headcount: 5, increaseMinor: 5_000_000 },
      ],
      increaseUsdMinor: 7_388_000,
    });
  });

  it('POST /api/simulations/raise writes nothing: the database is unchanged after the call', async () => {
    const before = databaseState();

    const everyone = await api().post('/api/simulations/raise').send({ filters: {}, pct: 50 });
    const india = await api()
      .post('/api/simulations/raise')
      .send({ filters: { country: 'IN' }, pct: 8 });

    expect(everyone.status).toBe(200);
    expect(india.status).toBe(200);
    expect(databaseState()).toEqual(before);
  });

  it('POST /api/simulations/raise leaves salaries and histories as they were, as the API reports them', async () => {
    const employeeBefore = await api().get('/api/employees/2');

    await api().post('/api/simulations/raise').send({ filters: {}, pct: 50 });

    const employeeAfter = await api().get('/api/employees/2');
    expect(employeeAfter.body).toEqual(employeeBefore.body);
    expect(employeeAfter.body).toMatchObject({
      fullName: 'Priya Sharma',
      salaryMinor: 120_000_000,
    });
  });

  it.each([
    { pct: 50.1, message: 'Raise percentage must be between 0 and 50' },
    { pct: -1, message: 'Raise percentage must be between 0 and 50' },
    { pct: 8.25, message: 'Raise percentage can have at most 1 decimal place' },
    { pct: '8', message: 'Enter a valid raise percentage' },
  ])(
    'POST /api/simulations/raise answers 400 for a percentage of $pct',
    async ({ pct, message }) => {
      const response = await api().post('/api/simulations/raise').send({ filters: {}, pct });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: 'INVALID_INPUT',
          message: 'The input is invalid',
          fields: [{ path: 'pct', message }],
        },
      });
    },
  );

  it('POST /api/simulations/raise answers 400 when the percentage is missing', async () => {
    const response = await api().post('/api/simulations/raise').send({ filters: {} });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        fields: [{ path: 'pct', message: 'Raise percentage is required' }],
      },
    });
  });

  it('POST /api/simulations/raise answers 400 for a bad filter, named under "filters"', async () => {
    const response = await api()
      .post('/api/simulations/raise')
      .send({ filters: { country: 'ZZ' }, pct: 8 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_INPUT',
        message: 'The input is invalid',
        fields: [{ path: 'filters.country', message: 'Select a supported country' }],
      },
    });
  });

  it('POST /api/simulations/raise answers 400 for an empty body', async () => {
    const response = await api().post('/api/simulations/raise').send();

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'INVALID_INPUT' } });
  });
});
