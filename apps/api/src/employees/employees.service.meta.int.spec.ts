import { describe, expect, it } from 'vitest';
import { FixedClock } from '../clock/clock.js';
import { createTestDb } from '../db/create-test-db.js';
import { EmployeesRepository } from './employees.repository.js';
import { EmployeesService } from './employees.service.js';

const NOW = '2026-11-19T10:30:00.000Z';

const FIVE_COUNTRIES_BY_NAME = [
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'US', name: 'United States', currency: 'USD' },
];

function setup() {
  const service = new EmployeesService(
    new EmployeesRepository(createTestDb()),
    new FixedClock(NOW),
  );
  let created = 0;
  const addEmployee = (department: string, jobTitle: string) => {
    created += 1;
    service.create({
      fullName: `Employee ${created}`,
      email: `employee${created}@acme.test`,
      jobTitle,
      department,
      countryCode: 'IN',
      salaryMajor: 1_000_000,
      employmentType: 'FULL_TIME',
      hireDate: '2024-03-01',
    });
  };
  return { service, addEmployee };
}

describe('EmployeesService.getMeta', () => {
  it('returns the five supported countries with code, name and currency only, sorted by name', () => {
    const { service } = setup();

    expect(service.getMeta().countries).toEqual(FIVE_COUNTRIES_BY_NAME);
  });

  it('returns each department and job title once, however many employees share it', () => {
    const { service, addEmployee } = setup();
    addEmployee('Engineering', 'Engineer');
    addEmployee('Engineering', 'Engineer');
    addEmployee('Engineering', 'Senior Engineer');

    expect(service.getMeta()).toMatchObject({
      departments: ['Engineering'],
      jobTitles: ['Engineer', 'Senior Engineer'],
    });
  });

  it('sorts departments and job titles A to Z, whatever order they were added in', () => {
    const { service, addEmployee } = setup();
    addEmployee('Sales', 'Senior Engineer');
    addEmployee('Engineering', 'Analyst');
    addEmployee('People', 'HR Partner');
    addEmployee('Finance', 'Account Executive');

    expect(service.getMeta()).toMatchObject({
      departments: ['Engineering', 'Finance', 'People', 'Sales'],
      jobTitles: ['Account Executive', 'Analyst', 'HR Partner', 'Senior Engineer'],
    });
  });

  it('returns empty department and job title lists, but still the countries, on an empty database', () => {
    const { service } = setup();

    expect(service.getMeta()).toEqual({
      countries: FIVE_COUNTRIES_BY_NAME,
      departments: [],
      jobTitles: [],
    });
  });

  it('drops a department and job title once the last employee using them is removed', () => {
    const { service, addEmployee } = setup();
    addEmployee('Engineering', 'Engineer');
    addEmployee('Sales', 'Account Executive');

    service.remove(2);

    expect(service.getMeta()).toMatchObject({
      departments: ['Engineering'],
      jobTitles: ['Engineer'],
    });
  });
});
