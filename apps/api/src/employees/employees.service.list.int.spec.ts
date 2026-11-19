import { beforeAll, describe, expect, it } from 'vitest';
import { FixedClock } from '../clock/clock.js';
import { createTestDb } from '../db/create-test-db.js';
import { EmployeesRepository } from './employees.repository.js';
import { EmployeesService } from './employees.service.js';
import { InvalidInputError } from './errors.js';

const NOW = '2026-11-19T10:30:00.000Z';

// 30 fixed employees, created in this order, so ids run 1 to 30 from top to bottom.
// [fullName, email local part, jobTitle, department, countryCode, salaryMajor, hireDate]
const SEED: [string, string, string, string, string, number, string][] = [
  ['Aarav Mehta', 'aarav.mehta', 'Engineer', 'Engineering', 'IN', 1_800_000, '2021-06-01'],
  ['Priya Sharma', 'priya.sharma', 'Senior Engineer', 'Engineering', 'IN', 3_240_000, '2019-03-01'],
  ['Rohan Iyer', 'rohan.iyer', 'Senior Engineer', 'Engineering', 'IN', 3_000_000, '2020-01-15'],
  ['Neha Kapoor', 'neha.kapoor', 'Engineer', 'Engineering', 'IN', 1_650_000, '2023-08-21'],
  ['Alice Johnson', 'alice.johnson', 'Senior Engineer', 'Engineering', 'US', 165_000, '2018-09-10'],
  // Brian (id 6) and Carla (id 7) share a salary: the salary tiebreaker pair.
  ["Brian O'Neil", 'brian.oneil', 'Engineer', 'Engineering', 'US', 120_000, '2022-02-14'],
  ['Carla Gomez', 'carla.gomez', 'Engineer', 'Engineering', 'US', 120_000, '2021-11-01'],
  ['Oliver Smith', 'oliver.smith', 'Senior Engineer', 'Engineering', 'GB', 95_000, '2017-05-22'],
  ['Emma Clarke', 'emma.clarke', 'Engineer', 'Engineering', 'GB', 62_000, '2024-01-08'],
  ['Hans Becker', 'hans.becker', 'Senior Engineer', 'Engineering', 'DE', 98_000, '2016-10-03'],
  ['Lena Fischer', 'lena.fischer', 'Engineer', 'Engineering', 'DE', 68_000, '2022-07-18'],
  ['Wei Ling Tan', 'weiling.tan', 'Senior Engineer', 'Engineering', 'SG', 132_000, '2019-12-02'],
  ['Ananya Rao', 'ananya.rao', 'Account Executive', 'Sales', 'IN', 1_400_000, '2022-04-04'],
  ['Vikram Singh', 'vikram.singh', 'Account Executive', 'Sales', 'IN', 1_550_000, '2020-09-28'],
  ['David Miller', 'david.miller', 'Account Executive', 'Sales', 'US', 98_000, '2019-06-17'],
  ['Grace Lee', 'grace.lee', 'Account Executive', 'Sales', 'US', 104_000, '2023-03-06'],
  ['Harry Wilson', 'harry.wilson', 'Account Executive', 'Sales', 'GB', 58_000, '2021-02-01'],
  // Jonas (id 18) and Sofia (id 20) share a salary and a hire date: the hire-date tiebreaker pair.
  ['Jonas Weber', 'jonas.weber', 'Account Executive', 'Sales', 'DE', 64_000, '2020-11-09'],
  ['Mei Chen', 'mei.chen', 'Account Executive', 'Sales', 'SG', 84_000, '2022-10-24'],
  ['Sofia Rossi', 'sofia.rossi', 'Account Executive', 'Sales', 'DE', 64_000, '2020-11-09'],
  ['Karan Patel', 'karan.patel', 'Analyst', 'Finance', 'IN', 1_200_000, '2023-01-16'],
  ['Emily Davis', 'emily.davis', 'Analyst', 'Finance', 'US', 88_000, '2021-08-30'],
  ['George Brown', 'george.brown', 'Analyst', 'Finance', 'GB', 52_000, '2022-05-09'],
  ['Klaus Schmidt', 'klaus.schmidt', 'Analyst', 'Finance', 'DE', 61_000, '2018-04-23'],
  ['Jia Hui Lim', 'jiahui.lim', 'Analyst', 'Finance', 'SG', 72_000, '2020-03-02'],
  ['Meera Nair', 'meera.nair', 'Analyst', 'Finance', 'IN', 1_250_000, '2019-07-15'],
  ['Sanjay Gupta', 'sanjay.gupta', 'HR Partner', 'People', 'IN', 1_300_000, '2017-11-13'],
  ['Laura White', 'laura.white', 'HR Partner', 'People', 'US', 92_000, '2020-06-22'],
  ['Isabel Schulz', 'isabel.schulz', 'HR Partner', 'People', 'DE', 66_000, '2021-09-06'],
  // The only row with a "%" in the name and the only one with a "_" in the email.
  ['Zara Ahmed (50%)', 'zara_ahmed', 'HR Partner', 'People', 'SG', 40_000, '2024-06-03'],
];

const ALL_NAMES_A_TO_Z = [
  'Aarav Mehta',
  'Alice Johnson',
  'Ananya Rao',
  "Brian O'Neil",
  'Carla Gomez',
  'David Miller',
  'Emily Davis',
  'Emma Clarke',
  'George Brown',
  'Grace Lee',
  'Hans Becker',
  'Harry Wilson',
  'Isabel Schulz',
  'Jia Hui Lim',
  'Jonas Weber',
  'Karan Patel',
  'Klaus Schmidt',
  'Laura White',
  'Lena Fischer',
  'Meera Nair',
  'Mei Chen',
  'Neha Kapoor',
  'Oliver Smith',
  'Priya Sharma',
  'Rohan Iyer',
  'Sanjay Gupta',
  'Sofia Rossi',
  'Vikram Singh',
  'Wei Ling Tan',
  'Zara Ahmed (50%)',
];

let service: EmployeesService;

// list() never writes, so one seeded database is shared by every test in this file.
beforeAll(() => {
  service = new EmployeesService(new EmployeesRepository(createTestDb()), new FixedClock(NOW));
  for (const [
    fullName,
    emailName,
    jobTitle,
    department,
    countryCode,
    salaryMajor,
    hireDate,
  ] of SEED) {
    service.create({
      fullName,
      email: `${emailName}@acme.test`,
      jobTitle,
      department,
      countryCode,
      salaryMajor,
      employmentType: 'FULL_TIME',
      hireDate,
    });
  }
});

function namesOf(query: unknown): string[] {
  return service.list(query).items.map((employee) => employee.fullName);
}

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw, but it returned');
}

describe('EmployeesService.list defaults', () => {
  it('returns the first 25 employees by name A to Z, with the total of all 30', () => {
    const result = service.list({});

    expect(result).toMatchObject({ total: 30, page: 1, pageSize: 25 });
    expect(result.items.map((employee) => employee.fullName)).toEqual(
      ALL_NAMES_A_TO_Z.slice(0, 25),
    );
  });

  it('returns each item as the full stored employee', () => {
    expect(service.list({ pageSize: 1 }).items).toEqual([
      {
        id: 1,
        fullName: 'Aarav Mehta',
        email: 'aarav.mehta@acme.test',
        jobTitle: 'Engineer',
        department: 'Engineering',
        countryCode: 'IN',
        currency: 'INR',
        salaryMinor: 180_000_000,
        employmentType: 'FULL_TIME',
        hireDate: '2021-06-01',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
  });

  it('accepts page and pageSize as query-string text', () => {
    expect(service.list({ page: '2', pageSize: '10' })).toMatchObject({ page: 2, pageSize: 10 });
  });

  it('ignores blank filters, as the shared schema treats them as not provided', () => {
    expect(service.list({ search: '  ', country: '', department: '', jobTitle: '' }).total).toBe(
      30,
    );
  });
});

describe('EmployeesService.list search', () => {
  it('matches part of the full name', () => {
    expect(namesOf({ search: 'priya' })).toEqual(['Priya Sharma']);
  });

  it('matches regardless of letter case', () => {
    expect(namesOf({ search: 'SHARMA' })).toEqual(['Priya Sharma']);
  });

  it('matches anywhere inside the name, not only at the start', () => {
    expect(namesOf({ search: 'sch' })).toEqual(['Isabel Schulz', 'Klaus Schmidt', 'Lena Fischer']);
  });

  it('matches on the email when the name does not match', () => {
    // "weiling.tan" and "oneil" appear only in the emails: the names are "Wei Ling Tan" and "O'Neil".
    expect(namesOf({ search: 'weiling.tan' })).toEqual(['Wei Ling Tan']);
    expect(namesOf({ search: 'oneil' })).toEqual(["Brian O'Neil"]);
  });

  it('handles an apostrophe in the search text', () => {
    expect(namesOf({ search: "o'neil" })).toEqual(["Brian O'Neil"]);
  });

  it.each([
    { search: '%', why: 'as a wildcard it would match all 30' },
    { search: '50%', why: 'the percent sign is part of the text' },
    { search: '_', why: 'as a wildcard it would match every non-empty value' },
    { search: 'a_a', why: 'as a wildcard it would also match "ara" in other names' },
  ])('treats "$search" as plain text, not a LIKE wildcard ($why)', ({ search }) => {
    expect(namesOf({ search })).toEqual(['Zara Ahmed (50%)']);
  });

  it('treats a backslash as plain text', () => {
    expect(namesOf({ search: '\\' })).toEqual([]);
  });
});

describe('EmployeesService.list filters', () => {
  it('filters by country', () => {
    const result = service.list({ country: 'GB' });

    expect(result.total).toBe(4);
    expect(result.items.map((employee) => employee.fullName)).toEqual([
      'Emma Clarke',
      'George Brown',
      'Harry Wilson',
      'Oliver Smith',
    ]);
  });

  it('filters by department', () => {
    expect(namesOf({ department: 'People' })).toEqual([
      'Isabel Schulz',
      'Laura White',
      'Sanjay Gupta',
      'Zara Ahmed (50%)',
    ]);
  });

  it('filters by job title as an exact match, so "Engineer" excludes "Senior Engineer"', () => {
    expect(namesOf({ jobTitle: 'Engineer' })).toEqual([
      'Aarav Mehta',
      "Brian O'Neil",
      'Carla Gomez',
      'Emma Clarke',
      'Lena Fischer',
      'Neha Kapoor',
    ]);
  });

  it('does not treat a department filter as a prefix', () => {
    expect(namesOf({ department: 'Eng' })).toEqual([]);
  });

  it('combines country and department', () => {
    expect(namesOf({ country: 'DE', department: 'Engineering' })).toEqual([
      'Hans Becker',
      'Lena Fischer',
    ]);
  });

  it('combines country and job title', () => {
    expect(namesOf({ country: 'IN', jobTitle: 'Senior Engineer' })).toEqual([
      'Priya Sharma',
      'Rohan Iyer',
    ]);
  });

  it('combines search with all three filters', () => {
    const query = {
      search: 'gomez',
      country: 'US',
      department: 'Engineering',
      jobTitle: 'Engineer',
    };

    // The filters alone leave Brian and Carla; the search narrows that to Carla.
    expect(service.list(query)).toMatchObject({ total: 1, items: [{ fullName: 'Carla Gomez' }] });
  });
});

describe('EmployeesService.list sorting', () => {
  it('sorts by name Z to A', () => {
    expect(namesOf({ sort: 'name', order: 'desc', pageSize: 3 })).toEqual([
      'Zara Ahmed (50%)',
      'Wei Ling Tan',
      'Vikram Singh',
    ]);
  });

  it('sorts by salary, lowest first', () => {
    expect(namesOf({ sort: 'salary', order: 'asc', pageSize: 4 })).toEqual([
      'Zara Ahmed (50%)',
      'George Brown',
      'Harry Wilson',
      'Klaus Schmidt',
    ]);
  });

  it('sorts by the raw salary amount without converting currencies, so INR salaries come first when highest first', () => {
    expect(namesOf({ sort: 'salary', order: 'desc', pageSize: 4 })).toEqual([
      'Priya Sharma',
      'Rohan Iyer',
      'Aarav Mehta',
      'Neha Kapoor',
    ]);
  });

  it('sorts by hire date, earliest first', () => {
    expect(namesOf({ sort: 'hireDate', order: 'asc', pageSize: 4 })).toEqual([
      'Hans Becker',
      'Oliver Smith',
      'Sanjay Gupta',
      'Klaus Schmidt',
    ]);
  });

  it('sorts by hire date, latest first', () => {
    expect(namesOf({ sort: 'hireDate', order: 'desc', pageSize: 4 })).toEqual([
      'Zara Ahmed (50%)',
      'Emma Clarke',
      'Neha Kapoor',
      'Grace Lee',
    ]);
  });

  it.each(['asc', 'desc'])('breaks a salary tie by lowest id first when sorting %s', (order) => {
    const usEngineers = { country: 'US', jobTitle: 'Engineer', sort: 'salary', order };

    expect(namesOf(usEngineers)).toEqual(["Brian O'Neil", 'Carla Gomez']);
  });

  it.each(['asc', 'desc'])('breaks a hire-date tie by lowest id first when sorting %s', (order) => {
    const germanSales = { country: 'DE', department: 'Sales', sort: 'hireDate', order };

    expect(namesOf(germanSales)).toEqual(['Jonas Weber', 'Sofia Rossi']);
  });

  it('keeps tied rows in the same order across a page boundary', () => {
    const germanSales = { country: 'DE', department: 'Sales', sort: 'hireDate', pageSize: 1 };

    expect(namesOf({ ...germanSales, page: 1 })).toEqual(['Jonas Weber']);
    expect(namesOf({ ...germanSales, page: 2 })).toEqual(['Sofia Rossi']);
  });
});

describe('EmployeesService.list pagination', () => {
  it('returns the remaining 5 on the second page of 25', () => {
    const result = service.list({ page: 2 });

    expect(result).toMatchObject({ total: 30, page: 2, pageSize: 25 });
    expect(result.items.map((employee) => employee.fullName)).toEqual(ALL_NAMES_A_TO_Z.slice(25));
  });

  it('returns a full last page when the total divides evenly', () => {
    expect(namesOf({ page: 3, pageSize: 10 })).toEqual(ALL_NAMES_A_TO_Z.slice(20, 30));
  });

  it('returns a partial last page when it does not', () => {
    expect(namesOf({ page: 5, pageSize: 7 })).toEqual(['Wei Ling Tan', 'Zara Ahmed (50%)']);
  });

  it('returns no items, but still the total, for a page beyond the end', () => {
    expect(service.list({ page: 99 })).toEqual({ items: [], total: 30, page: 99, pageSize: 25 });
  });

  it('covers every employee exactly once across consecutive pages', () => {
    const pages = [1, 2, 3, 4, 5].flatMap((page) => namesOf({ page, pageSize: 7 }));

    expect(pages).toEqual(ALL_NAMES_A_TO_Z);
  });

  it('reports the total of the filtered set, not of the page', () => {
    const result = service.list({ country: 'IN', pageSize: 2 });

    expect(result).toMatchObject({ total: 9, page: 1, pageSize: 2 });
    expect(result.items.map((employee) => employee.fullName)).toEqual([
      'Aarav Mehta',
      'Ananya Rao',
    ]);
  });
});

describe('EmployeesService.list with nothing to return', () => {
  it('returns an empty page and a total of 0 when nothing matches', () => {
    expect(service.list({ search: 'nobody-by-this-name' })).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });
  });

  it('returns an empty page and a total of 0 when there are no employees at all', () => {
    const emptyService = new EmployeesService(
      new EmployeesRepository(createTestDb()),
      new FixedClock(NOW),
    );

    expect(emptyService.list({})).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
  });
});

describe('EmployeesService.list validation', () => {
  it.each([
    { query: { sort: 'email' }, path: 'sort', message: 'Sort must be name, salary or hireDate' },
    { query: { order: 'up' }, path: 'order', message: 'Order must be asc or desc' },
    { query: { page: '0' }, path: 'page', message: 'Page must be a whole number of at least 1' },
    {
      query: { pageSize: '101' },
      path: 'pageSize',
      message: 'Page size must be a whole number between 1 and 100',
    },
    { query: { country: 'ZZ' }, path: 'country', message: 'Select a supported country' },
  ])('rejects an invalid $path with the shared schema message', ({ query, path, message }) => {
    const error = thrownBy(() => service.list(query));

    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error).toMatchObject({ issues: [{ path, message }] });
  });
});
