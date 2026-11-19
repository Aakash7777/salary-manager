import { z } from 'zod';
import { getCountry } from './countries.js';

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACTOR'] as const;
export const EMPLOYEE_SORT_FIELDS = ['name', 'salary', 'hireDate'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

// Every supported currency has 2 minor units, so the largest salary that still fits a safe
// integer once converted to minor units is MAX_SAFE_INTEGER / 100, rounded down.
const MAX_SALARY_MAJOR = 90_071_992_547_409;
const AT_MOST_TWO_DECIMALS = /^\d+(\.\d{1,2})?$/;

function isSupportedCountry(code: string): boolean {
  try {
    getCountry(code);
    return true;
  } catch {
    return false;
  }
}

function requiredText(label: string, maxLength: number) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} must be at most ${maxLength} characters`);
}

function pastOrTodayDate(label: string, today: string) {
  return z.iso
    .date({
      abort: true,
      error: (issue) =>
        issue.input === undefined
          ? `${label} is required`
          : `${label} must be a valid date (YYYY-MM-DD)`,
    })
    .refine((date) => date <= today, `${label} cannot be in the future`);
}

const fullName = requiredText('Full name', 200);
const jobTitle = requiredText('Job title', 100);
const department = requiredText('Department', 100);

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email must be at most 254 characters')
  .pipe(z.email('Enter a valid email address'));

const countryCode = z
  .string({ error: 'Country is required' })
  .refine(isSupportedCountry, 'Select a supported country');

const employmentType = z.enum(EMPLOYMENT_TYPES, {
  error: (issue) =>
    issue.input === undefined
      ? 'Employment type is required'
      : 'Employment type must be FULL_TIME, PART_TIME or CONTRACTOR',
});

const salaryMajor = z
  .number({
    error: (issue) => (issue.input === undefined ? 'Salary is required' : 'Enter a valid salary'),
  })
  .superRefine((salary, context) => {
    if (salary <= 0) {
      context.addIssue({ code: 'custom', message: 'Salary must be greater than 0' });
    } else if (salary > MAX_SALARY_MAJOR) {
      context.addIssue({ code: 'custom', message: 'Salary is too large' });
    } else if (!AT_MOST_TWO_DECIMALS.test(String(salary))) {
      context.addIssue({ code: 'custom', message: 'Salary can have at most 2 decimal places' });
    }
  });

const reason = z
  .string({ error: 'Reason is required' })
  .trim()
  .min(3, 'Reason must be at least 3 characters')
  .max(500, 'Reason must be at most 500 characters');

export function createEmployeeInputSchema(today: string) {
  return z.strictObject({
    fullName,
    email,
    jobTitle,
    department,
    countryCode,
    salaryMajor,
    employmentType,
    hireDate: pastOrTodayDate('Hire date', today),
  });
}

export interface UpdateEmployeeDetailsContext {
  today: string;
  currentCountryCode: string;
}

export function updateEmployeeDetailsInputSchema({
  today,
  currentCountryCode,
}: UpdateEmployeeDetailsContext) {
  return z
    .strictObject({
      fullName: fullName.optional(),
      email: email.optional(),
      jobTitle: jobTitle.optional(),
      department: department.optional(),
      countryCode: countryCode.optional(),
      employmentType: employmentType.optional(),
      hireDate: pastOrTodayDate('Hire date', today).optional(),
      newSalaryMajor: salaryMajor.optional(),
      reason: reason.optional(),
    })
    .superRefine((input, context) => {
      // An unsupported country already has its own error, so it does not count as a change.
      const countryChanges =
        input.countryCode !== undefined &&
        input.countryCode !== currentCountryCode &&
        isSupportedCountry(input.countryCode);

      if (!countryChanges) {
        if (input.newSalaryMajor !== undefined) {
          context.addIssue({
            code: 'custom',
            path: ['newSalaryMajor'],
            message:
              'Salary can only be changed here when the country changes. Use "Change salary" instead',
          });
        }
        if (input.reason !== undefined) {
          context.addIssue({
            code: 'custom',
            path: ['reason'],
            message:
              'A reason can only be given here when the country changes. Use "Change salary" instead',
          });
        }
        return;
      }
      if (input.newSalaryMajor === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['newSalaryMajor'],
          message: 'A new salary is required when the country changes',
        });
      }
      if (input.reason === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['reason'],
          message: 'A reason is required when the country changes',
        });
      }
    });
}

export function changeSalaryInputSchema(today: string) {
  return z.strictObject({
    newSalaryMajor: salaryMajor,
    effectiveDate: pastOrTodayDate('Effective date', today),
    reason,
  });
}

function withoutBlankValues(query: unknown): unknown {
  if (typeof query !== 'object' || query === null) {
    return query;
  }
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => !(typeof value === 'string' && value.trim() === ''),
    ),
  );
}

const PAGE_MESSAGE = 'Page must be a whole number of at least 1';
const PAGE_SIZE_MESSAGE = 'Page size must be a whole number between 1 and 100';

// A cleared filter arrives from the URL as an empty string; that means "not provided".
export const listEmployeesQuerySchema = z.preprocess(
  withoutBlankValues,
  z.object({
    search: z.string().trim().max(100, 'Search must be at most 100 characters').optional(),
    country: countryCode.optional(),
    department: z.string().trim().optional(),
    jobTitle: z.string().trim().optional(),
    sort: z
      .enum(EMPLOYEE_SORT_FIELDS, { error: 'Sort must be name, salary or hireDate' })
      .default('name'),
    order: z.enum(SORT_ORDERS, { error: 'Order must be asc or desc' }).default('asc'),
    page: z.coerce
      .number({ error: PAGE_MESSAGE })
      .int(PAGE_MESSAGE)
      .min(1, PAGE_MESSAGE)
      .default(1),
    pageSize: z.coerce
      .number({ error: PAGE_SIZE_MESSAGE })
      .int(PAGE_SIZE_MESSAGE)
      .min(1, PAGE_SIZE_MESSAGE)
      .max(100, PAGE_SIZE_MESSAGE)
      .default(25),
  }),
);

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_ORDERS)[number];

export type CreateEmployeeInput = z.infer<ReturnType<typeof createEmployeeInputSchema>>;
export type UpdateEmployeeDetailsInput = z.infer<
  ReturnType<typeof updateEmployeeDetailsInputSchema>
>;
export type ChangeSalaryInput = z.infer<ReturnType<typeof changeSalaryInputSchema>>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
