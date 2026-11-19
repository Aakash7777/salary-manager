import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

/** The shape of one employee as the API returns it. */
export interface ApiEmployee {
  id: number;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  currency: string;
  salaryMinor: number;
  employmentType: string;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

function employee(
  id: number,
  fullName: string,
  rest: Omit<ApiEmployee, 'id' | 'fullName' | 'email' | 'createdAt' | 'updatedAt'>,
): ApiEmployee {
  return {
    id,
    fullName,
    email: `${fullName.toLowerCase().replace(' ', '.')}@acme.test`,
    ...rest,
    createdAt: '2026-11-19T10:30:00.000Z',
    updatedAt: '2026-11-19T10:30:00.000Z',
  };
}

export const FIRST_PAGE: ApiEmployee[] = [
  employee(1, 'Aarav Mehta', {
    jobTitle: 'Engineer',
    department: 'Engineering',
    countryCode: 'IN',
    currency: 'INR',
    salaryMinor: 180_000_000,
    employmentType: 'FULL_TIME',
    hireDate: '2021-06-12',
  }),
  employee(2, 'Priya Sharma', {
    jobTitle: 'Senior Engineer',
    department: 'Engineering',
    countryCode: 'IN',
    currency: 'INR',
    salaryMinor: 324_000_000,
    employmentType: 'FULL_TIME',
    hireDate: '2024-03-01',
  }),
  employee(3, 'Hans Becker', {
    jobTitle: 'Analyst',
    department: 'Finance',
    countryCode: 'DE',
    currency: 'EUR',
    salaryMinor: 9_800_050,
    employmentType: 'PART_TIME',
    hireDate: '2016-10-03',
  }),
];

export const SECOND_PAGE: ApiEmployee[] = [
  employee(26, 'Zara Ahmed', {
    jobTitle: 'Account Executive',
    department: 'Sales',
    countryCode: 'SG',
    currency: 'SGD',
    salaryMinor: 8_400_000,
    employmentType: 'CONTRACTOR',
    hireDate: '2022-10-24',
  }),
];

export const META = {
  countries: [
    { code: 'DE', name: 'Germany', currency: 'EUR' },
    { code: 'IN', name: 'India', currency: 'INR' },
    { code: 'SG', name: 'Singapore', currency: 'SGD' },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
    { code: 'US', name: 'United States', currency: 'USD' },
  ],
  departments: ['Engineering', 'Finance', 'Sales'],
  jobTitles: ['Account Executive', 'Analyst', 'Engineer', 'Senior Engineer'],
};

export const TOTAL_EMPLOYEES = 1_240;

/** Every GET /api/employees the app has made in the current test, oldest first. */
export const employeeRequests: Record<string, string>[] = [];

export function lastEmployeeRequest(): Record<string, string> {
  return employeeRequests.at(-1) ?? {};
}

/** The default API: page 2 has one employee, every other page has the same three. */
export const handlers = [
  http.get('*/api/meta', () => HttpResponse.json(META)),
  http.get('*/api/employees', ({ request }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    employeeRequests.push(params);
    const page = Number(params.page ?? '1');
    return HttpResponse.json({
      items: page === 2 ? SECOND_PAGE : FIRST_PAGE,
      total: TOTAL_EMPLOYEES,
      page,
      pageSize: 25,
    });
  }),
];

export const server = setupServer(...handlers);

export const EMPLOYEES_URL = '*/api/employees';

export function emptyPage() {
  return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 25 });
}

export function serverError() {
  return HttpResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } },
    { status: 500 },
  );
}
