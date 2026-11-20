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

// ---------------------------------------------------------------------------------------------
// One employee in full, as GET /api/employees/:id returns it, and the write endpoints.
// ---------------------------------------------------------------------------------------------

export interface ApiSalaryChange {
  id: number;
  employeeId: number;
  oldSalaryMinor: number | null;
  oldCurrency: string | null;
  newSalaryMinor: number;
  currency: string;
  effectiveDate: string;
  reason: string;
  createdAt: string;
}

export interface ApiEmployeeDetail extends ApiEmployee {
  salaryHistory: ApiSalaryChange[];
  roleMedianMinor: number | null;
  pctVsRoleMedian: number | null;
}

function change(
  id: number,
  rest: Omit<ApiSalaryChange, 'id' | 'employeeId' | 'createdAt'>,
): ApiSalaryChange {
  return { id, employeeId: 2, ...rest, createdAt: '2026-11-19T10:30:00.000Z' };
}

/**
 * Priya started in the UK, moved to India, took a pay cut and was later promoted, so her
 * history has one entry of every kind. Newest first, as the API returns it.
 */
export const PRIYA_DETAIL: ApiEmployeeDetail = {
  ...employee(2, 'Priya Sharma', {
    jobTitle: 'Senior Engineer',
    department: 'Engineering',
    countryCode: 'IN',
    currency: 'INR',
    salaryMinor: 324_000_000,
    employmentType: 'FULL_TIME',
    hireDate: '2021-03-12',
  }),
  salaryHistory: [
    change(13, {
      oldSalaryMinor: 300_000_000,
      oldCurrency: 'INR',
      newSalaryMinor: 324_000_000,
      currency: 'INR',
      effectiveDate: '2025-04-01',
      reason: 'Promotion to Senior Engineer',
    }),
    change(12, {
      oldSalaryMinor: 310_000_000,
      oldCurrency: 'INR',
      newSalaryMinor: 300_000_000,
      currency: 'INR',
      effectiveDate: '2023-07-01',
      reason: 'Reduced working hours',
    }),
    change(11, {
      oldSalaryMinor: 2_800_000,
      oldCurrency: 'GBP',
      newSalaryMinor: 310_000_000,
      currency: 'INR',
      effectiveDate: '2022-01-10',
      reason: 'Relocated to Bengaluru',
    }),
    change(10, {
      oldSalaryMinor: null,
      oldCurrency: null,
      newSalaryMinor: 2_800_000,
      currency: 'GBP',
      effectiveDate: '2021-03-12',
      reason: 'Starting salary',
    }),
  ],
  // (32,40,000 - 30,50,000) / 30,50,000 = 6.2%
  roleMedianMinor: 305_000_000,
  pctVsRoleMedian: 6.2,
};

/** What POST /api/employees answers with: the newly created employee, id 101. */
export const CREATED_EMPLOYEE: ApiEmployee = employee(101, 'Neha Kapoor', {
  jobTitle: 'Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  currency: 'INR',
  salaryMinor: 180_000_000,
  employmentType: 'CONTRACTOR',
  hireDate: '2026-11-01',
});

const CREATED_DETAIL: ApiEmployeeDetail = {
  ...CREATED_EMPLOYEE,
  salaryHistory: [
    {
      id: 500,
      employeeId: 101,
      oldSalaryMinor: null,
      oldCurrency: null,
      newSalaryMinor: 180_000_000,
      currency: 'INR',
      effectiveDate: '2026-11-01',
      reason: 'Starting salary',
      createdAt: '2026-11-19T10:30:00.000Z',
    },
  ],
  roleMedianMinor: null,
  pctVsRoleMedian: null,
};

/** Every write (POST, PATCH, DELETE) the app has made in the current test, oldest first. */
export const apiWrites: { method: string; path: string; body: unknown }[] = [];

async function recordWrite(request: Request): Promise<unknown> {
  const body: unknown = request.method === 'DELETE' ? undefined : await request.json();
  apiWrites.push({ method: request.method, path: new URL(request.url).pathname, body });
  return body;
}

export const EMPLOYEE_URL = '*/api/employees/:id';
export const CREATE_URL = '*/api/employees';
export const SALARY_CHANGES_URL = '*/api/employees/:id/salary-changes';
export const PRIYA_URL = '*/api/employees/2';

export function notFound(id: string) {
  return HttpResponse.json(
    { error: { code: 'EMPLOYEE_NOT_FOUND', message: `Employee ${id} was not found` } },
    { status: 404 },
  );
}

export function invalidInput(fields: { path: string; message: string }[]) {
  return HttpResponse.json(
    { error: { code: 'INVALID_INPUT', message: 'The input is invalid', fields } },
    { status: 400 },
  );
}

export function emailInUse(email: string) {
  return HttpResponse.json(
    {
      error: {
        code: 'EMAIL_ALREADY_IN_USE',
        message: `An employee with the email ${email} already exists`,
      },
    },
    { status: 409 },
  );
}

export function detailOf(overrides: Partial<ApiEmployeeDetail>) {
  return HttpResponse.json({ ...PRIYA_DETAIL, ...overrides });
}

handlers.push(
  http.get(EMPLOYEE_URL, ({ params }) => {
    if (params.id === '2') return HttpResponse.json(PRIYA_DETAIL);
    if (params.id === '101') return HttpResponse.json(CREATED_DETAIL);
    return notFound(String(params.id));
  }),
  http.post(SALARY_CHANGES_URL, async ({ request }) => {
    await recordWrite(request);
    return HttpResponse.json(PRIYA_DETAIL, { status: 201 });
  }),
  http.post(CREATE_URL, async ({ request }) => {
    await recordWrite(request);
    return HttpResponse.json(CREATED_EMPLOYEE, { status: 201 });
  }),
  http.patch(EMPLOYEE_URL, async ({ request }) => {
    const body = (await recordWrite(request)) as Record<string, unknown>;
    return HttpResponse.json({ ...PRIYA_DETAIL, ...body });
  }),
  http.delete(EMPLOYEE_URL, async ({ request }) => {
    await recordWrite(request);
    return new HttpResponse(null, { status: 204 });
  }),
);

// ---------------------------------------------------------------------------------------------
// Insights: three countries, with India drilled down into three roles and two outliers.
// ---------------------------------------------------------------------------------------------

export const INSIGHTS_SUMMARY = {
  headcount: 7_950,
  countryCount: 3,
  departmentCount: 8,
  jobTitleCount: 60,
  // USD 662,797,585.00, shown rounded as "USD 663M".
  payrollUsdMinor: 66_279_758_500,
  fxTableVersion: '2026-11',
};

/** Largest headcount first, as the API returns them. Every amount is in that country's currency. */
export const INSIGHTS_COUNTRIES = [
  {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    headcount: 4_200,
    minMinor: 57_500_000,
    medianMinor: 175_000_000,
    avgMinor: 186_930_000,
    maxMinor: 517_000_000,
  },
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    headcount: 2_650,
    minMinor: 3_800_000,
    medianMinor: 11_700_000,
    avgMinor: 12_485_700,
    maxMinor: 38_050_000,
  },
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    headcount: 1_100,
    minMinor: 3_000_000,
    medianMinor: 6_650_000,
    avgMinor: 7_120_000,
    maxMinor: 20_300_000,
  },
];

/** Highest median first, as the API returns them. */
export const INDIA_JOB_TITLES = {
  country: { code: 'IN', name: 'India', currency: 'INR' },
  jobTitles: [
    {
      jobTitle: 'Staff Engineer',
      headcount: 300,
      minMinor: 450_000_000,
      medianMinor: 520_000_000,
      avgMinor: 531_000_000,
      maxMinor: 780_000_000,
    },
    {
      jobTitle: 'Senior Engineer',
      headcount: 1_200,
      minMinor: 220_000_000,
      medianMinor: 261_000_000,
      avgMinor: 265_000_000,
      maxMinor: 410_000_000,
    },
    {
      jobTitle: 'Engineer',
      headcount: 2_700,
      minMinor: 57_500_000,
      medianMinor: 126_000_000,
      avgMinor: 129_000_000,
      maxMinor: 210_000_000,
    },
  ],
  // Largest gap first. (20.0 - 12.6) / 12.6 = +58.7%; (18.0 - 26.1) / 26.1 = -31.0%.
  outliers: [
    {
      employeeId: 41,
      fullName: 'Neha Kapoor',
      jobTitle: 'Engineer',
      salaryMinor: 200_000_000,
      roleMedianMinor: 126_000_000,
      differencePct: 58.7,
      direction: 'above',
    },
    {
      employeeId: 87,
      fullName: 'Aarav Mehta',
      jobTitle: 'Senior Engineer',
      salaryMinor: 180_000_000,
      roleMedianMinor: 261_000_000,
      differencePct: -31,
      direction: 'below',
    },
  ],
};

const GERMANY_JOB_TITLES = {
  country: { code: 'DE', name: 'Germany', currency: 'EUR' },
  jobTitles: [
    {
      jobTitle: 'Engineer',
      headcount: 1_100,
      minMinor: 3_000_000,
      medianMinor: 6_650_000,
      avgMinor: 7_120_000,
      maxMinor: 20_300_000,
    },
  ],
  outliers: [],
};

/** Singapore is supported but has no employees in this fixture. */
const SINGAPORE_JOB_TITLES = {
  country: { code: 'SG', name: 'Singapore', currency: 'SGD' },
  jobTitles: [],
  outliers: [],
};

export const INSIGHTS_SUMMARY_URL = '*/api/insights/summary';
export const INSIGHTS_COUNTRIES_URL = '*/api/insights/countries';
export const COUNTRY_JOB_TITLES_URL = '*/api/insights/countries/:code/job-titles';

/** Every country code the app has asked job-title insights for in the current test. */
export const jobTitleRequests: string[] = [];

handlers.push(
  http.get(INSIGHTS_SUMMARY_URL, () => HttpResponse.json(INSIGHTS_SUMMARY)),
  http.get(INSIGHTS_COUNTRIES_URL, () => HttpResponse.json(INSIGHTS_COUNTRIES)),
  http.get(COUNTRY_JOB_TITLES_URL, ({ params }) => {
    const code = String(params.code);
    jobTitleRequests.push(code);
    if (code === 'IN') return HttpResponse.json(INDIA_JOB_TITLES);
    if (code === 'DE') return HttpResponse.json(GERMANY_JOB_TITLES);
    if (code === 'SG') return HttpResponse.json(SINGAPORE_JOB_TITLES);
    return invalidInput([{ path: 'code', message: 'Select a supported country' }]);
  }),
);

// ---------------------------------------------------------------------------------------------
// Raise simulator: an 8% raise for 6,850 people in three currencies.
// ---------------------------------------------------------------------------------------------

/** Rows in order of currency code, as the API returns them. Every amount is in that row's currency. */
export const SIMULATION = {
  headcount: 6_850,
  byCurrency: [
    {
      currency: 'EUR',
      headcount: 1_100,
      // EUR 78,320,000 + 6,265,600 = 84,585,600
      currentTotalMinor: 7_832_000_000,
      increaseMinor: 626_560_000,
      newTotalMinor: 8_458_560_000,
    },
    {
      currency: 'INR',
      headcount: 4_200,
      // INR 7,85,10,60,000 + 62,80,84,800 = 8,47,91,44,800
      currentTotalMinor: 785_106_000_000,
      increaseMinor: 62_808_480_000,
      newTotalMinor: 847_914_480_000,
    },
    {
      currency: 'USD',
      headcount: 1_550,
      // USD 193,500,000 + 15,480,000 = 208,980,000
      currentTotalMinor: 19_350_000_000,
      increaseMinor: 1_548_000_000,
      newTotalMinor: 20_898_000_000,
    },
  ],
  // EUR 6,265,600 x 1.08 + INR 628,084,800 x 0.012 + USD 15,480,000
  //   = 6,766,848.00 + 7,537,017.60 + 15,480,000.00 = USD 29,783,865.60, shown as "USD 29,783,866".
  increaseUsdMinor: 2_978_386_560,
  fxTableVersion: '2026-11',
};

export const NOBODY_MATCHES = {
  headcount: 0,
  byCurrency: [],
  increaseUsdMinor: 0,
  fxTableVersion: '2026-11',
};

export const SIMULATE_RAISE_URL = '*/api/simulations/raise';

export interface SimulationRequest {
  filters?: Record<string, unknown>;
  pct?: unknown;
}

/** The body of every POST /api/simulations/raise the app has made in the current test. */
export const simulationRequests: SimulationRequest[] = [];

export function lastSimulationRequest(): SimulationRequest {
  return simulationRequests.at(-1) ?? {};
}

/** Answers every simulation with the same result, and remembers what was asked. */
handlers.push(
  http.post(SIMULATE_RAISE_URL, async ({ request }) => {
    simulationRequests.push((await request.json()) as SimulationRequest);
    return HttpResponse.json(SIMULATION);
  }),
);

// Created last, once every handler above exists.
export const server = setupServer(...handlers);
