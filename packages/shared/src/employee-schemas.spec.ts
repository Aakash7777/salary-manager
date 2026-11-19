import { describe, expect, it } from 'vitest';
import {
  changeSalaryInputSchema,
  createEmployeeInputSchema,
  listEmployeesQuerySchema,
  updateEmployeeDetailsInputSchema,
} from './employee-schemas.js';

const TODAY = '2026-11-19';
const TOMORROW = '2026-11-20';

interface ParseResult {
  success: boolean;
  data?: unknown;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}

interface Schema {
  safeParse(input: unknown): ParseResult;
}

function issuesOf(schema: Schema, input: unknown): string[] {
  const result = schema.safeParse(input);
  return (result.error?.issues ?? []).map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

function parsed(schema: Schema, input: unknown): unknown {
  const result = schema.safeParse(input);
  expect(issuesOf(schema, input)).toEqual([]);
  return result.data;
}

const validCreateInput = {
  fullName: 'Priya Sharma',
  email: 'priya.sharma@acme.test',
  jobTitle: 'Senior Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  salaryMajor: 3_240_000,
  employmentType: 'FULL_TIME',
  hireDate: '2024-03-01',
};

describe('createEmployeeInputSchema', () => {
  const schema = createEmployeeInputSchema(TODAY);

  it('accepts a complete, valid employee and returns it unchanged', () => {
    expect(parsed(schema, validCreateInput)).toEqual(validCreateInput);
  });

  it('trims the text fields and lowercases the email', () => {
    const result = parsed(schema, {
      ...validCreateInput,
      fullName: '  Priya Sharma ',
      email: ' Priya.Sharma@ACME.test ',
      jobTitle: ' Senior Engineer ',
      department: ' Engineering ',
    });

    expect(result).toEqual(validCreateInput);
  });

  it.each([
    { field: 'fullName', message: 'Full name is required' },
    { field: 'email', message: 'Email is required' },
    { field: 'jobTitle', message: 'Job title is required' },
    { field: 'department', message: 'Department is required' },
    { field: 'countryCode', message: 'Country is required' },
    { field: 'salaryMajor', message: 'Salary is required' },
    { field: 'employmentType', message: 'Employment type is required' },
    { field: 'hireDate', message: 'Hire date is required' },
  ])('requires $field', ({ field, message }) => {
    const input: Record<string, unknown> = { ...validCreateInput };
    delete input[field];

    expect(issuesOf(schema, input)).toEqual([`${field}: ${message}`]);
  });

  it.each([
    { field: 'fullName', message: 'Full name is required' },
    { field: 'jobTitle', message: 'Job title is required' },
    { field: 'department', message: 'Department is required' },
  ])('rejects a blank $field', ({ field, message }) => {
    expect(issuesOf(schema, { ...validCreateInput, [field]: '   ' })).toEqual([
      `${field}: ${message}`,
    ]);
  });

  it.each(['not-an-email', 'priya@', '@acme.test', 'priya sharma@acme.test'])(
    'rejects the malformed email "%s"',
    (email) => {
      expect(issuesOf(schema, { ...validCreateInput, email })).toEqual([
        'email: Enter a valid email address',
      ]);
    },
  );

  it.each([
    { field: 'fullName', max: 200, label: 'Full name' },
    { field: 'jobTitle', max: 100, label: 'Job title' },
    { field: 'department', max: 100, label: 'Department' },
  ])('accepts a $field of $max characters and rejects one more', ({ field, max, label }) => {
    const atLimit = 'x'.repeat(max);
    const overLimit = 'x'.repeat(max + 1);

    expect(parsed(schema, { ...validCreateInput, [field]: atLimit })).toMatchObject({
      [field]: atLimit,
    });
    expect(issuesOf(schema, { ...validCreateInput, [field]: overLimit })).toEqual([
      `${field}: ${label} must be at most ${max} characters`,
    ]);
  });

  it('accepts an email of 254 characters and rejects one more', () => {
    const emailOfLength = (length: number): string => `p@${'a'.repeat(length - 7)}.test`;

    expect(parsed(schema, { ...validCreateInput, email: emailOfLength(254) })).toMatchObject({
      email: emailOfLength(254),
    });
    expect(issuesOf(schema, { ...validCreateInput, email: emailOfLength(255) })).toEqual([
      'email: Email must be at most 254 characters',
    ]);
  });

  it('rejects a country that is not in the country config', () => {
    expect(issuesOf(schema, { ...validCreateInput, countryCode: 'ZZ' })).toEqual([
      'countryCode: Select a supported country',
    ]);
  });

  it('does not accept currency as an input, because it is derived from the country', () => {
    expect(issuesOf(schema, { ...validCreateInput, currency: 'USD' })).toEqual([
      ': Unrecognized key: "currency"',
    ]);
  });

  it.each([0, -1, -50_000.5])('rejects a salary of %s because it must be above zero', (salary) => {
    expect(issuesOf(schema, { ...validCreateInput, salaryMajor: salary })).toEqual([
      'salaryMajor: Salary must be greater than 0',
    ]);
  });

  it('accepts a salary with two decimals', () => {
    const result = parsed(schema, { ...validCreateInput, salaryMajor: 85_000.75 });

    expect(result).toMatchObject({ salaryMajor: 85_000.75 });
  });

  it('rejects a salary with more than two decimals', () => {
    expect(issuesOf(schema, { ...validCreateInput, salaryMajor: 85_000.755 })).toEqual([
      'salaryMajor: Salary can have at most 2 decimal places',
    ]);
  });

  it.each([NaN, Infinity, '85000', 'abc', null])(
    'rejects %s as a salary because it is not a finite number',
    (salary) => {
      expect(issuesOf(schema, { ...validCreateInput, salaryMajor: salary })).toEqual([
        'salaryMajor: Enter a valid salary',
      ]);
    },
  );

  it('rejects a salary too large to store exactly in minor units', () => {
    expect(issuesOf(schema, { ...validCreateInput, salaryMajor: 90_071_992_547_410 })).toEqual([
      'salaryMajor: Salary is too large',
    ]);
  });

  it.each(['FULL_TIME', 'PART_TIME', 'CONTRACTOR'])(
    'accepts the employment type %s',
    (employmentType) => {
      expect(parsed(schema, { ...validCreateInput, employmentType })).toMatchObject({
        employmentType,
      });
    },
  );

  it.each(['INTERN', 'full_time', ''])('rejects the employment type "%s"', (employmentType) => {
    expect(issuesOf(schema, { ...validCreateInput, employmentType })).toEqual([
      'employmentType: Employment type must be FULL_TIME, PART_TIME or CONTRACTOR',
    ]);
  });

  it('accepts a hire date of today', () => {
    expect(parsed(schema, { ...validCreateInput, hireDate: TODAY })).toMatchObject({
      hireDate: TODAY,
    });
  });

  it('rejects a hire date in the future', () => {
    expect(issuesOf(schema, { ...validCreateInput, hireDate: TOMORROW })).toEqual([
      'hireDate: Hire date cannot be in the future',
    ]);
  });

  it.each(['01/03/2024', '2024-3-1', '2024-02-30', '2024-03-01T00:00:00Z', 'yesterday'])(
    'rejects "%s" because it is not a real YYYY-MM-DD date',
    (hireDate) => {
      expect(issuesOf(schema, { ...validCreateInput, hireDate })).toEqual([
        'hireDate: Hire date must be a valid date (YYYY-MM-DD)',
      ]);
    },
  );

  it('reports every invalid field at once', () => {
    const issues = issuesOf(schema, {
      ...validCreateInput,
      email: 'not-an-email',
      salaryMajor: 0,
      hireDate: TOMORROW,
    });

    expect(issues).toEqual([
      'email: Enter a valid email address',
      'salaryMajor: Salary must be greater than 0',
      'hireDate: Hire date cannot be in the future',
    ]);
  });
});

describe('updateEmployeeDetailsInputSchema', () => {
  const schema = updateEmployeeDetailsInputSchema({ today: TODAY, currentCountryCode: 'IN' });

  it('accepts an empty update, because every field is optional', () => {
    expect(parsed(schema, {})).toEqual({});
  });

  it('accepts a single changed field', () => {
    expect(parsed(schema, { jobTitle: 'Staff Engineer' })).toEqual({ jobTitle: 'Staff Engineer' });
  });

  it('accepts every detail field together when the country is unchanged', () => {
    const input = {
      fullName: 'Priya Sharma',
      email: 'priya.sharma@acme.test',
      jobTitle: 'Staff Engineer',
      department: 'Platform',
      countryCode: 'IN',
      employmentType: 'PART_TIME',
      hireDate: '2024-03-01',
    };

    expect(parsed(schema, input)).toEqual(input);
  });

  it.each([
    { input: { fullName: '   ' }, issue: 'fullName: Full name is required' },
    { input: { email: 'not-an-email' }, issue: 'email: Enter a valid email address' },
    { input: { jobTitle: '' }, issue: 'jobTitle: Job title is required' },
    { input: { department: '' }, issue: 'department: Department is required' },
    { input: { countryCode: 'ZZ' }, issue: 'countryCode: Select a supported country' },
    {
      input: { employmentType: 'INTERN' },
      issue: 'employmentType: Employment type must be FULL_TIME, PART_TIME or CONTRACTOR',
    },
    { input: { hireDate: TOMORROW }, issue: 'hireDate: Hire date cannot be in the future' },
    {
      input: { hireDate: '2024-02-30' },
      issue: 'hireDate: Hire date must be a valid date (YYYY-MM-DD)',
    },
  ])('applies the create rules to a provided field: $issue', ({ input, issue }) => {
    expect(issuesOf(schema, input)).toEqual([issue]);
  });

  it('does not accept salaryMajor, because salary is not editable in "Edit details"', () => {
    expect(issuesOf(schema, { salaryMajor: 3_500_000 })).toEqual([
      ': Unrecognized key: "salaryMajor"',
    ]);
  });

  it('does not accept currency as an input, because it is derived from the country', () => {
    expect(issuesOf(schema, { currency: 'EUR' })).toEqual([': Unrecognized key: "currency"']);
  });

  it('rejects a new salary when the country is not changing', () => {
    const issues = issuesOf(schema, { newSalaryMajor: 3_500_000 });

    expect(issues).toEqual([
      'newSalaryMajor: Salary can only be changed here when the country changes. Use "Change salary" instead',
    ]);
  });

  it('rejects a reason when the country is not changing', () => {
    const issues = issuesOf(schema, { reason: 'Annual raise' });

    expect(issues).toEqual([
      'reason: A reason can only be given here when the country changes. Use "Change salary" instead',
    ]);
  });

  it('treats the current country as no change, so a new salary and a reason are both rejected', () => {
    const issues = issuesOf(schema, {
      countryCode: 'IN',
      newSalaryMajor: 3_500_000,
      reason: 'Annual raise',
    });

    expect(issues).toEqual([
      'newSalaryMajor: Salary can only be changed here when the country changes. Use "Change salary" instead',
      'reason: A reason can only be given here when the country changes. Use "Change salary" instead',
    ]);
  });

  it('requires a new salary in the new currency and a reason when the country changes', () => {
    expect(issuesOf(schema, { countryCode: 'DE' })).toEqual([
      'newSalaryMajor: A new salary is required when the country changes',
      'reason: A reason is required when the country changes',
    ]);
  });

  it('requires a reason when the country changes, even if a new salary is given', () => {
    expect(issuesOf(schema, { countryCode: 'DE', newSalaryMajor: 85_000 })).toEqual([
      'reason: A reason is required when the country changes',
    ]);
  });

  it('requires a new salary when the country changes, even if a reason is given', () => {
    expect(issuesOf(schema, { countryCode: 'DE', reason: 'Relocated to Berlin' })).toEqual([
      'newSalaryMajor: A new salary is required when the country changes',
    ]);
  });

  it('accepts a country change that comes with a new salary and a reason', () => {
    const input = { countryCode: 'DE', newSalaryMajor: 85_000, reason: 'Relocated to Berlin' };

    expect(parsed(schema, input)).toEqual(input);
  });

  it.each([
    { newSalaryMajor: 0, issue: 'newSalaryMajor: Salary must be greater than 0' },
    {
      newSalaryMajor: 85_000.755,
      issue: 'newSalaryMajor: Salary can have at most 2 decimal places',
    },
    { newSalaryMajor: NaN, issue: 'newSalaryMajor: Enter a valid salary' },
  ])('applies the salary rules to the new salary: $issue', ({ newSalaryMajor, issue }) => {
    const input = { countryCode: 'DE', newSalaryMajor, reason: 'Relocated to Berlin' };

    expect(issuesOf(schema, input)).toEqual([issue]);
  });

  it('applies the reason length rules to a country change', () => {
    const input = { countryCode: 'DE', newSalaryMajor: 85_000, reason: 'ab' };

    expect(issuesOf(schema, input)).toEqual(['reason: Reason must be at least 3 characters']);
  });
});

describe('changeSalaryInputSchema', () => {
  const schema = changeSalaryInputSchema(TODAY);
  const validChange = {
    newSalaryMajor: 3_600_000,
    effectiveDate: '2026-11-01',
    reason: 'Promotion to Staff Engineer',
  };

  it('accepts a valid salary change and returns it unchanged', () => {
    expect(parsed(schema, validChange)).toEqual(validChange);
  });

  it('accepts a salary change effective today', () => {
    expect(parsed(schema, { ...validChange, effectiveDate: TODAY })).toMatchObject({
      effectiveDate: TODAY,
    });
  });

  it('rejects a salary change dated in the future', () => {
    expect(issuesOf(schema, { ...validChange, effectiveDate: TOMORROW })).toEqual([
      'effectiveDate: Effective date cannot be in the future',
    ]);
  });

  it.each(['01/11/2026', '2026-02-30', 'today'])(
    'rejects the effective date "%s" because it is not a real YYYY-MM-DD date',
    (effectiveDate) => {
      expect(issuesOf(schema, { ...validChange, effectiveDate })).toEqual([
        'effectiveDate: Effective date must be a valid date (YYYY-MM-DD)',
      ]);
    },
  );

  it.each([0, -100])('rejects a new salary of %s because it must be above zero', (salary) => {
    expect(issuesOf(schema, { ...validChange, newSalaryMajor: salary })).toEqual([
      'newSalaryMajor: Salary must be greater than 0',
    ]);
  });

  it('rejects a new salary with more than two decimals', () => {
    expect(issuesOf(schema, { ...validChange, newSalaryMajor: 3_600_000.123 })).toEqual([
      'newSalaryMajor: Salary can have at most 2 decimal places',
    ]);
  });

  it('requires a reason for every salary change', () => {
    const withoutReason = {
      newSalaryMajor: validChange.newSalaryMajor,
      effectiveDate: validChange.effectiveDate,
    };

    expect(issuesOf(schema, withoutReason)).toEqual(['reason: Reason is required']);
  });

  it.each(['', 'ab', '  ab  ', '     '])(
    'rejects the reason "%s" because it is under 3 characters once trimmed',
    (reason) => {
      expect(issuesOf(schema, { ...validChange, reason })).toEqual([
        'reason: Reason must be at least 3 characters',
      ]);
    },
  );

  it('rejects a reason longer than 500 characters', () => {
    expect(issuesOf(schema, { ...validChange, reason: 'x'.repeat(501) })).toEqual([
      'reason: Reason must be at most 500 characters',
    ]);
  });

  it.each([3, 500])('accepts a reason of exactly %s characters', (length) => {
    const reason = 'x'.repeat(length);

    expect(parsed(schema, { ...validChange, reason })).toMatchObject({ reason });
  });

  it.each([
    { field: 'newSalaryMajor', message: 'Salary is required' },
    { field: 'effectiveDate', message: 'Effective date is required' },
  ])('requires $field', ({ field, message }) => {
    const input: Record<string, unknown> = { ...validChange };
    delete input[field];

    expect(issuesOf(schema, input)).toEqual([`${field}: ${message}`]);
  });

  it('does not accept currency as an input, because it is derived from the country', () => {
    expect(issuesOf(schema, { ...validChange, currency: 'USD' })).toEqual([
      ': Unrecognized key: "currency"',
    ]);
  });
});

describe('listEmployeesQuerySchema', () => {
  const schema = listEmployeesQuerySchema;

  it('defaults to the first page of 25, sorted by name ascending', () => {
    expect(parsed(schema, {})).toStrictEqual({ sort: 'name', order: 'asc', page: 1, pageSize: 25 });
  });

  it('parses a full query string, turning page and pageSize into numbers', () => {
    const result = parsed(schema, {
      search: 'priya',
      country: 'IN',
      department: 'Engineering',
      jobTitle: 'Senior Engineer',
      sort: 'salary',
      order: 'desc',
      page: '3',
      pageSize: '50',
    });

    expect(result).toEqual({
      search: 'priya',
      country: 'IN',
      department: 'Engineering',
      jobTitle: 'Senior Engineer',
      sort: 'salary',
      order: 'desc',
      page: 3,
      pageSize: 50,
    });
  });

  it('trims the search text', () => {
    expect(parsed(schema, { search: '  priya ' })).toMatchObject({ search: 'priya' });
  });

  it('accepts a search of 100 characters and rejects one more', () => {
    const atLimit = 'x'.repeat(100);

    expect(parsed(schema, { search: atLimit })).toMatchObject({ search: atLimit });
    expect(issuesOf(schema, { search: 'x'.repeat(101) })).toEqual([
      'search: Search must be at most 100 characters',
    ]);
  });

  it.each([
    { blank: '', description: 'empty' },
    { blank: '   ', description: 'whitespace-only' },
  ])(
    'treats $description query values as not provided: filters are omitted and the rest use defaults',
    ({ blank }) => {
      const result = parsed(schema, {
        search: blank,
        country: blank,
        department: blank,
        jobTitle: blank,
        sort: blank,
        order: blank,
        page: blank,
        pageSize: blank,
      });

      expect(result).toStrictEqual({ sort: 'name', order: 'asc', page: 1, pageSize: 25 });
    },
  );

  it.each(['name', 'salary', 'hireDate'])('accepts sorting by %s', (sort) => {
    expect(parsed(schema, { sort })).toMatchObject({ sort });
  });

  it.each(['email', 'Name'])('rejects sorting by "%s"', (sort) => {
    expect(issuesOf(schema, { sort })).toEqual(['sort: Sort must be name, salary or hireDate']);
  });

  it.each(['up', 'ASC'])('rejects the sort order "%s"', (order) => {
    expect(issuesOf(schema, { order })).toEqual(['order: Order must be asc or desc']);
  });

  it.each(['0', '-1', '1.5', 'abc'])('rejects page "%s"', (page) => {
    expect(issuesOf(schema, { page })).toEqual(['page: Page must be a whole number of at least 1']);
  });

  it.each(['1', '100'])('accepts a page size of %s', (pageSize) => {
    expect(parsed(schema, { pageSize })).toMatchObject({ pageSize: Number(pageSize) });
  });

  it.each(['0', '101', '10.5', 'abc'])('rejects page size "%s"', (pageSize) => {
    expect(issuesOf(schema, { pageSize })).toEqual([
      'pageSize: Page size must be a whole number between 1 and 100',
    ]);
  });

  it('rejects a country filter that is not in the country config', () => {
    expect(issuesOf(schema, { country: 'ZZ' })).toEqual(['country: Select a supported country']);
  });
});
