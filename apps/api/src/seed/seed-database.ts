import { Faker, base, de, en, en_GB, en_IN, en_US } from '@faker-js/faker';
import { currencyFor, toMinor } from '@salary-manager/shared';
import type { AppDatabase } from '../db/database.js';
import {
  COUNTRY_PROFILES,
  type CountryProfile,
  DEPARTMENTS,
  EMPLOYMENT_TYPE_WEIGHTS,
  LEVELS,
  RAISE_REASONS,
  SINGAPORE_FIRST_NAMES,
  SINGAPORE_LAST_NAMES,
} from './seed-catalog.js';

export interface SeedOptions {
  count: number;
  seed: number;
  /** ISO date (YYYY-MM-DD). Every generated date is derived from it; the system clock is never read. */
  referenceDate: string;
}

export interface SeedReport {
  employees: number;
  salaryChanges: number;
}

interface SeedSalaryChange {
  oldSalaryMinor: number | null;
  oldCurrency: string | null;
  newSalaryMinor: number;
  currency: string;
  effectiveDate: string;
  reason: string;
}

interface SeedEmployee {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  currency: string;
  salaryMinor: number;
  employmentType: string;
  hireDate: string;
  /** Oldest first, starting with the "Starting salary" row. */
  history: SeedSalaryChange[];
}

const STARTING_SALARY_REASON = 'Starting salary';
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HIRING_WINDOW_IN_YEARS = 12;

// A normal salary sits within 10% of its band's midpoint, so nobody in a band is more than
// 25% from the band's median by chance. The outliers are placed well outside that on purpose.
const NORMAL_SPREAD = 0.1;
const OUTLIER_SHARE = 0.03;
const LOW_OUTLIER_FACTOR = { min: 0.62, max: 0.7 };
const HIGH_OUTLIER_FACTOR = { min: 1.35, max: 1.7 };

const SHARE_WITH_RAISES = 0.31;
const MIN_DAYS_OF_TENURE_PER_RAISE = 180;
const RAISE_COUNT_WEIGHTS = [
  { value: 1, weight: 50 },
  { value: 2, weight: 30 },
  { value: 3, weight: 20 },
];
const RAISE_FRACTION = { min: 0.03, max: 0.15 };

function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function roundToMultiple(value: number, multiple: number): number {
  return Math.max(multiple, Math.round(value / multiple) * multiple);
}

/** Splits `count` by share using largest remainders, so the parts always add up to `count`. */
function countryQuotas(count: number): { country: CountryProfile; quota: number }[] {
  const quotas = COUNTRY_PROFILES.map((country) => {
    const exact = country.share * count;
    return { country, quota: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let unassigned = count - quotas.reduce((sum, entry) => sum + entry.quota, 0);
  for (const entry of [...quotas].sort((a, b) => b.remainder - a.remainder)) {
    if (unassigned === 0) {
      break;
    }
    entry.quota += 1;
    unassigned -= 1;
  }
  return quotas.map(({ country, quota }) => ({ country, quota }));
}

function emailNamePart(name: string): string {
  return name
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function generateEmployees({ count, seed, referenceDate }: SeedOptions): SeedEmployee[] {
  const random = new Faker({ locale: [en, base] });
  random.seed(seed);

  const nameSources: Record<string, Faker> = {
    IN: new Faker({ locale: [en_IN, en, base] }),
    US: new Faker({ locale: [en_US, en, base] }),
    GB: new Faker({ locale: [en_GB, en, base] }),
    DE: new Faker({ locale: [de, en, base] }),
  };
  Object.values(nameSources).forEach((source, index) => source.seed(seed + index + 1));

  const referenceMs = Date.parse(`${referenceDate}T00:00:00.000Z`);
  const reference = new Date(referenceMs);
  const windowStartMs = Date.UTC(
    reference.getUTCFullYear() - HIRING_WINDOW_IN_YEARS,
    reference.getUTCMonth(),
    reference.getUTCDate(),
  );
  const daysInWindow = Math.round((referenceMs - windowStartMs) / DAY_IN_MS);

  const countryOfEachEmployee = random.helpers.shuffle(
    countryQuotas(count).flatMap(({ country, quota }) =>
      Array<CountryProfile>(quota).fill(country),
    ),
  );
  const departmentChoices = DEPARTMENTS.map((department) => ({
    value: department,
    weight: department.weight,
  }));
  const timesEmailNameUsed = new Map<string, number>();

  return countryOfEachEmployee.map((country): SeedEmployee => {
    const names = nameSources[country.code];
    const firstName = names
      ? names.person.firstName()
      : random.helpers.arrayElement(SINGAPORE_FIRST_NAMES);
    const lastName = names
      ? names.person.lastName()
      : random.helpers.arrayElement(SINGAPORE_LAST_NAMES);

    // Two people with the same name get "name" and "name2": unique, and still readable.
    const emailName =
      [emailNamePart(firstName), emailNamePart(lastName)].filter(Boolean).join('.') || 'employee';
    const timesUsed = (timesEmailNameUsed.get(emailName) ?? 0) + 1;
    timesEmailNameUsed.set(emailName, timesUsed);
    const email = `${emailName}${timesUsed === 1 ? '' : timesUsed}@acme.test`;

    const department = random.helpers.weightedArrayElement(departmentChoices);
    const [jobTitle, level] = random.helpers.weightedArrayElement(
      department.titles.map((title) => ({ value: title, weight: LEVELS[title[1]].weight })),
    );
    const bandMidpoint = country.midLevelBase * department.payFactor * LEVELS[level].payFactor;

    const isOutlier = random.number.float({ min: 0, max: 1 }) < OUTLIER_SHARE;
    const outlierRange = random.datatype.boolean() ? HIGH_OUTLIER_FACTOR : LOW_OUTLIER_FACTOR;
    const payFactor = isOutlier
      ? random.number.float(outlierRange)
      : random.number.float({ min: 1 - NORMAL_SPREAD, max: 1 + NORMAL_SPREAD });
    const currentSalary = roundToMultiple(bandMidpoint * payFactor, country.roundTo);

    const hireDay = random.number.int({ min: 0, max: daysInWindow });
    const daysOfTenure = daysInWindow - hireDay;
    const wantsRaises = random.number.float({ min: 0, max: 1 }) < SHARE_WITH_RAISES;
    const raiseCount = Math.min(
      wantsRaises ? random.helpers.weightedArrayElement(RAISE_COUNT_WEIGHTS) : 0,
      Math.floor(daysOfTenure / MIN_DAYS_OF_TENURE_PER_RAISE),
    );
    const raiseDays = random.helpers
      .uniqueArray(() => random.number.int({ min: hireDay + 1, max: daysInWindow }), raiseCount)
      .sort((a, b) => a - b);

    // Salaries are worked out backwards from today's, so the current salary stays inside its
    // band however many raises led up to it.
    const salaryAfterEachStep = [currentSalary];
    for (let step = 0; step < raiseDays.length; step += 1) {
      const later = salaryAfterEachStep[0] ?? currentSalary;
      const earlier = roundToMultiple(
        later / (1 + random.number.float(RAISE_FRACTION)),
        country.roundTo,
      );
      // Rounding must never produce a "raise" that changes nothing.
      salaryAfterEachStep.unshift(earlier === later ? later - country.roundTo : earlier);
    }

    const currency = currencyFor(country.code);
    const hireDate = isoDate(windowStartMs + hireDay * DAY_IN_MS);
    const history = salaryAfterEachStep.map((salary, step): SeedSalaryChange => {
      const previous = salaryAfterEachStep[step - 1];
      const raiseDay = raiseDays[step - 1];
      return previous === undefined || raiseDay === undefined
        ? {
            oldSalaryMinor: null,
            oldCurrency: null,
            newSalaryMinor: toMinor(salary, currency),
            currency,
            effectiveDate: hireDate,
            reason: STARTING_SALARY_REASON,
          }
        : {
            oldSalaryMinor: toMinor(previous, currency),
            oldCurrency: currency,
            newSalaryMinor: toMinor(salary, currency),
            currency,
            effectiveDate: isoDate(windowStartMs + raiseDay * DAY_IN_MS),
            reason: random.helpers.arrayElement(RAISE_REASONS),
          };
    });

    return {
      fullName: `${firstName} ${lastName}`,
      email,
      jobTitle,
      department: department.name,
      countryCode: country.code,
      currency,
      salaryMinor: toMinor(currentSalary, currency),
      employmentType: random.helpers.weightedArrayElement(EMPLOYMENT_TYPE_WEIGHTS),
      hireDate,
      history,
    };
  });
}

/**
 * Fills the database with generated employees and their salary history.
 * It writes straight to the tables for speed, bypassing EmployeesService, so the generator
 * above is responsible for producing only data the service would have accepted.
 */
export function seedDatabase(db: AppDatabase, options: SeedOptions): SeedReport {
  const generated = generateEmployees(options);
  const timestamp = `${options.referenceDate}T00:00:00.000Z`;

  const sqlite = db.$client;
  const insertEmployee = sqlite.prepare(`
    INSERT INTO employees (
      full_name, email, job_title, department, country_code, currency,
      salary_minor, employment_type, hire_date, created_at, updated_at
    ) VALUES (
      @fullName, @email, @jobTitle, @department, @countryCode, @currency,
      @salaryMinor, @employmentType, @hireDate, @timestamp, @timestamp
    )
  `);
  const insertSalaryChange = sqlite.prepare(`
    INSERT INTO salary_changes (
      employee_id, old_salary_minor, old_currency, new_salary_minor, currency,
      effective_date, reason, created_at
    ) VALUES (
      @employeeId, @oldSalaryMinor, @oldCurrency, @newSalaryMinor, @currency,
      @effectiveDate, @reason, @timestamp
    )
  `);

  let salaryChanges = 0;
  const insertEverything = sqlite.transaction(() => {
    for (const { history, ...employee } of generated) {
      const employeeId = insertEmployee.run({ ...employee, timestamp }).lastInsertRowid;
      for (const change of history) {
        insertSalaryChange.run({ ...change, employeeId, timestamp });
        salaryChanges += 1;
      }
    }
  });
  insertEverything();

  return { employees: generated.length, salaryChanges };
}
