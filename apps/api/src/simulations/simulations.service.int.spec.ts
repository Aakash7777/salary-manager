import { describe, expect, it } from 'vitest';
import { FixedClock } from '../clock/clock.js';
import { createTestDb } from '../db/create-test-db.js';
import { EmployeesRepository } from '../employees/employees.repository.js';
import { EmployeesService } from '../employees/employees.service.js';
import { InvalidInputError } from '../employees/errors.js';
import { createPayFixture } from '../testing/pay-fixture.js';
import { SimulationsService } from './simulations.service.js';

const NOW = '2026-11-19T10:30:00.000Z';

/**
 * The 13 fixture employees: India INR 7,300,000 (6 people), United States USD 500,000 (5),
 * Germany EUR 140,000 (2). See pay-fixture.ts for each person.
 */
function setup() {
  const db = createTestDb();
  const repository = new EmployeesRepository(db);
  createPayFixture(new EmployeesService(repository, new FixedClock(NOW)));
  return { db, simulations: new SimulationsService(repository) };
}

type TestDb = ReturnType<typeof createTestDb>;

/** Everything stored, plus SQLite's own count of rows written on this connection. */
function databaseState(db: TestDb) {
  return {
    employees: db.$client.prepare('SELECT * FROM employees ORDER BY id').all(),
    salaryChanges: db.$client.prepare('SELECT * FROM salary_changes ORDER BY id').all(),
    rowsWritten: db.$client.prepare('SELECT total_changes() AS total').get(),
  };
}

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('SimulationsService.simulateRaise', () => {
  it('costs a raise for everyone, per currency, with the matched headcount and an indicative USD total', () => {
    const { simulations } = setup();

    // 10% of each country's payroll, each converted to USD on its own and then added:
    //   EUR  14,000 x 1.08  = USD 15,120.00
    //   INR 730,000 x 0.012 = USD  8,760.00
    //   USD  50,000 x 1     = USD 50,000.00
    //                         USD 73,880.00
    expect(simulations.simulateRaise({ filters: {}, pct: 10 })).toEqual({
      headcount: 13,
      byCurrency: [
        {
          currency: 'EUR',
          headcount: 2,
          currentTotalMinor: 14_000_000,
          increaseMinor: 1_400_000,
          newTotalMinor: 15_400_000,
        },
        {
          currency: 'INR',
          headcount: 6,
          currentTotalMinor: 730_000_000,
          increaseMinor: 73_000_000,
          newTotalMinor: 803_000_000,
        },
        {
          currency: 'USD',
          headcount: 5,
          currentTotalMinor: 50_000_000,
          increaseMinor: 5_000_000,
          newTotalMinor: 55_000_000,
        },
      ],
      increaseUsdMinor: 7_388_000,
      fxTableVersion: '2026-11',
    });
  });

  it('treats missing filters as everyone', () => {
    const { simulations } = setup();

    expect(simulations.simulateRaise({ pct: 10 })).toMatchObject({
      headcount: 13,
      increaseUsdMinor: 7_388_000,
    });
  });

  it('answers "what would an 8% raise for Engineers in India cost?"', () => {
    const { simulations } = setup();

    // Four Engineers on INR 1,000,000 + 1,200,000 + 1,400,000 + 2,000,000 = 5,600,000.
    // 8% = INR 448,000, which is USD 5,376.00 at 0.012.
    expect(
      simulations.simulateRaise({ filters: { country: 'IN', jobTitle: 'Engineer' }, pct: 8 }),
    ).toEqual({
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

  it('filters by department', () => {
    const { simulations } = setup();

    // The two Analysts in Finance: INR 800,000 + 900,000.
    expect(
      simulations.simulateRaise({ filters: { department: 'Finance' }, pct: 10 }),
    ).toMatchObject({
      headcount: 2,
      byCurrency: [{ currency: 'INR', headcount: 2, increaseMinor: 17_000_000 }],
      increaseUsdMinor: 204_000,
    });
  });

  it('filters by search, on name or email, exactly as the directory does', () => {
    const { simulations } = setup();

    // Priya Sharma alone, on INR 1,200,000.
    expect(simulations.simulateRaise({ filters: { search: 'SHARMA' }, pct: 5 })).toMatchObject({
      headcount: 1,
      byCurrency: [
        {
          currency: 'INR',
          headcount: 1,
          currentTotalMinor: 120_000_000,
          increaseMinor: 6_000_000,
          newTotalMinor: 126_000_000,
        },
      ],
      increaseUsdMinor: 72_000,
    });
  });

  it('applies a percentage with one decimal to each person', () => {
    const { simulations } = setup();

    // 12.5% of USD 95,000 + 105,000 + 70,000 + 140,000 + 90,000
    //     = 11,875 + 13,125 + 8,750 + 17,500 + 11,250 = USD 62,500.
    expect(simulations.simulateRaise({ filters: { country: 'US' }, pct: 12.5 })).toMatchObject({
      headcount: 5,
      byCurrency: [{ currency: 'USD', increaseMinor: 6_250_000, newTotalMinor: 56_250_000 }],
      increaseUsdMinor: 6_250_000,
    });
  });

  it('covers every matching employee, not one page of them: sort and paging in the filters are ignored', () => {
    const { simulations } = setup();

    expect(
      simulations.simulateRaise({
        filters: { sort: 'salary', order: 'desc', page: 2, pageSize: 1 },
        pct: 10,
      }),
    ).toMatchObject({ headcount: 13, increaseUsdMinor: 7_388_000 });
  });

  it('returns a headcount of zero and no rows when nobody matches', () => {
    const { simulations } = setup();

    expect(simulations.simulateRaise({ filters: { country: 'SG' }, pct: 10 })).toEqual({
      headcount: 0,
      byCurrency: [],
      increaseUsdMinor: 0,
      fxTableVersion: '2026-11',
    });
  });

  it('is read-only: the database is unchanged after a simulation', () => {
    const { db, simulations } = setup();
    const before = databaseState(db);

    simulations.simulateRaise({ filters: {}, pct: 50 });
    simulations.simulateRaise({ filters: { country: 'IN' }, pct: 8 });

    expect(databaseState(db)).toEqual(before);
  });

  it.each([
    {
      what: 'a raise above 50%',
      input: { filters: {}, pct: 50.1 },
      path: 'pct',
      message: 'Raise percentage must be between 0 and 50',
    },
    {
      what: 'a negative raise',
      input: { filters: {}, pct: -1 },
      path: 'pct',
      message: 'Raise percentage must be between 0 and 50',
    },
    {
      what: 'a raise with two decimals',
      input: { filters: {}, pct: 8.25 },
      path: 'pct',
      message: 'Raise percentage can have at most 1 decimal place',
    },
    {
      what: 'a missing percentage',
      input: { filters: {} },
      path: 'pct',
      message: 'Raise percentage is required',
    },
    {
      what: 'a percentage sent as text',
      input: { filters: {}, pct: '8' },
      path: 'pct',
      message: 'Enter a valid raise percentage',
    },
    {
      what: 'an unsupported country in the filters',
      input: { filters: { country: 'ZZ' }, pct: 8 },
      path: 'filters.country',
      message: 'Select a supported country',
    },
  ])('rejects $what as invalid input', ({ input, path, message }) => {
    const { simulations } = setup();

    const error = thrownBy(() => simulations.simulateRaise(input));

    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error).toMatchObject({ issues: [{ path, message }] });
  });

  it('rejects a body that is not an object', () => {
    const { simulations } = setup();

    expect(thrownBy(() => simulations.simulateRaise(undefined))).toBeInstanceOf(InvalidInputError);
    expect(thrownBy(() => simulations.simulateRaise('8%'))).toBeInstanceOf(InvalidInputError);
  });
});
