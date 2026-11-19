import { describe, expect, it } from 'vitest';
import { FixedClock } from '../clock/clock.js';
import { createTestDb } from '../db/create-test-db.js';
import { seedDatabase } from '../seed/seed-database.js';
import { createPayFixture } from '../testing/pay-fixture.js';
import { EmployeesRepository } from './employees.repository.js';
import { EmployeesService } from './employees.service.js';
import { InvalidInputError } from './errors.js';

// At 10:30 UTC on the 19th it is already the 20th at UTC+14, so clock.today() is 2026-11-20.
const NOW = '2026-11-19T10:30:00.000Z';
const BOM = String.fromCharCode(0xfeff);
const HEADER =
  'Name,Email,Job title,Department,Country,Currency,Annual salary,Employment type,Hire date';

function setup({ withPayFixture }: { withPayFixture: boolean }) {
  const db = createTestDb();
  const service = new EmployeesService(new EmployeesRepository(db), new FixedClock(NOW));
  if (withPayFixture) {
    createPayFixture(service);
  }
  return { db, service };
}

function csvOf(service: EmployeesService, query: unknown): string {
  return [...service.exportCsv(query).chunks].join('');
}

/** The data lines of an export: without the BOM, the header and the empty piece after the last CRLF. */
function dataLinesOf(service: EmployeesService, query: unknown): string[] {
  return csvOf(service, query).split('\r\n').slice(1, -1);
}

function addEmployee(service: EmployeesService, overrides: Record<string, unknown>): void {
  service.create({
    fullName: 'Extra Person',
    email: 'extra.person@acme.test',
    jobTitle: 'Engineer',
    department: 'Engineering',
    countryCode: 'DE',
    salaryMajor: 70_000,
    employmentType: 'FULL_TIME',
    hireDate: '2022-01-10',
    ...overrides,
  });
}

describe('EmployeesService.exportCsv', () => {
  it('starts with a UTF-8 byte order mark and the header row', () => {
    const { service } = setup({ withPayFixture: true });

    expect(csvOf(service, {}).startsWith(`${BOM}${HEADER}\r\n`)).toBe(true);
  });

  it('names the file after the clock’s today', () => {
    const { service } = setup({ withPayFixture: true });

    expect(service.exportCsv({}).filename).toBe('employees-2026-11-20.csv');
  });

  it('writes one line per employee, by name A to Z like the list, each ending in CRLF', () => {
    const { service } = setup({ withPayFixture: true });

    const csv = csvOf(service, {});
    const lines = dataLinesOf(service, {});

    expect(csv.endsWith('\r\n')).toBe(true);
    expect(lines).toHaveLength(13);
    expect(lines[0]).toBe(
      'Aarav Mehta,aarav.mehta@acme.test,Engineer,Engineering,India,INR,1000000,Full-time,2022-01-10',
    );
    expect(lines.map((line) => line.split(',')[0])).toEqual([
      'Aarav Mehta',
      'Alice Johnson',
      'Ananya Rao',
      "Brian O'Neil",
      'Carla Gomez',
      'David Miller',
      'Evan Wright',
      'Hans Becker',
      'Karan Patel',
      'Lena Fischer',
      'Neha Kapoor',
      'Priya Sharma',
      'Rohan Iyer',
    ]);
  });

  it('respects the country filter', () => {
    const { service } = setup({ withPayFixture: true });

    expect(dataLinesOf(service, { country: 'DE' })).toEqual([
      'Hans Becker,hans.becker@acme.test,Engineer,Engineering,Germany,EUR,80000,Full-time,2022-01-10',
      'Lena Fischer,lena.fischer@acme.test,Engineer,Engineering,Germany,EUR,60000,Full-time,2022-01-10',
    ]);
  });

  it('respects search, department and job title filters together', () => {
    const { service } = setup({ withPayFixture: true });

    const lines = dataLinesOf(service, {
      search: 'a',
      country: 'IN',
      department: 'Finance',
      jobTitle: 'Analyst',
    });

    expect(lines.map((line) => line.split(',')[0])).toEqual(['Ananya Rao', 'Karan Patel']);
  });

  it('respects sort and order', () => {
    const { service } = setup({ withPayFixture: true });

    const lines = dataLinesOf(service, { country: 'US', sort: 'salary', order: 'desc' });

    expect(lines.map((line) => line.split(',')[0])).toEqual([
      'Evan Wright',
      "Brian O'Neil",
      'Alice Johnson',
      'David Miller',
      'Carla Gomez',
    ]);
  });

  it('ignores page and pageSize, because an export is never paginated', () => {
    const { service } = setup({ withPayFixture: true });

    expect(dataLinesOf(service, { page: '3', pageSize: '2' })).toHaveLength(13);
  });

  it('exports every matching employee exactly once, in list order, when there are thousands', () => {
    const { db, service } = setup({ withPayFixture: false });
    seedDatabase(db, { count: 2_500, seed: 20261119, referenceDate: '2026-11-01' });

    const emails = dataLinesOf(service, { sort: 'hireDate', order: 'desc' }).map(
      (line) => /[^,"]+@acme\.test/.exec(line)?.[0],
    );
    const firstPageOfList = service
      .list({ sort: 'hireDate', order: 'desc', pageSize: 100 })
      .items.map((employee) => employee.email);

    expect(emails).toHaveLength(2_500);
    expect(new Set(emails).size).toBe(2_500);
    expect(emails.slice(0, 100)).toEqual(firstPageOfList);
  });

  it('escapes a name containing a comma and double quotes', () => {
    const { service } = setup({ withPayFixture: false });
    addEmployee(service, { fullName: 'Sharma, Priya "PJ"' });

    expect(dataLinesOf(service, {})).toEqual([
      '"Sharma, Priya ""PJ""",extra.person@acme.test,Engineer,Engineering,Germany,EUR,70000,Full-time,2022-01-10',
    ]);
  });

  it('neutralises a formula typed into a name or job title', () => {
    const { service } = setup({ withPayFixture: false });
    addEmployee(service, { fullName: '=cmd|calc', jobTitle: '@SUM(A1:A9)' });

    expect(dataLinesOf(service, {})[0]).toBe(
      "'=cmd|calc,extra.person@acme.test,'@SUM(A1:A9),Engineering,Germany,EUR,70000,Full-time,2022-01-10",
    );
  });

  it('keeps non-English characters and writes a salary with cents as a plain decimal', () => {
    const { service } = setup({ withPayFixture: false });
    addEmployee(service, { fullName: 'Jürgen Müller', salaryMajor: 70_000.35 });

    expect(dataLinesOf(service, {})[0]).toContain('Jürgen Müller,');
    expect(dataLinesOf(service, {})[0]).toContain(',EUR,70000.35,');
  });

  it('writes only the header when nothing matches', () => {
    const { service } = setup({ withPayFixture: true });

    expect(csvOf(service, { search: 'nobody-by-this-name' })).toBe(`${BOM}${HEADER}\r\n`);
  });

  it('rejects an invalid filter straight away, before any of the file is produced', () => {
    const { service } = setup({ withPayFixture: true });

    let thrown: unknown;
    try {
      service.exportCsv({ sort: 'email' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InvalidInputError);
    expect(thrown).toMatchObject({
      issues: [{ path: 'sort', message: 'Sort must be name, salary or hireDate' }],
    });
  });
});
