export interface Employee {
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

export interface SalaryChange {
  id: number;
  employeeId: number;
  /** Null, together with oldCurrency, on the "Starting salary" entry. */
  oldSalaryMinor: number | null;
  /** Differs from `currency` only when the change came from a country change. */
  oldCurrency: string | null;
  newSalaryMinor: number;
  currency: string;
  effectiveDate: string;
  reason: string;
  createdAt: string;
}

export interface EmployeeDetail extends Employee {
  /** Newest first. */
  salaryHistory: SalaryChange[];
  /** Null when the employee is the only one with their job title in their country. */
  roleMedianMinor: number | null;
  pctVsRoleMedian: number | null;
}

export interface EmployeePage {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Meta {
  countries: { code: string; name: string; currency: string }[];
  departments: string[];
  jobTitles: string[];
}

export interface InsightsSummary {
  headcount: number;
  countryCount: number;
  departmentCount: number;
  jobTitleCount: number;
  /** Indicative: converted with the fixed FX table named by fxTableVersion. */
  payrollUsdMinor: number;
  fxTableVersion: string;
}

/** Headcount and salary statistics, all in one local currency. */
export interface PayStats {
  headcount: number;
  minMinor: number;
  medianMinor: number;
  avgMinor: number;
  maxMinor: number;
}

export interface CountryRef {
  code: string;
  name: string;
  currency: string;
}

export type CountryPay = CountryRef & PayStats;
export type JobTitlePay = { jobTitle: string } & PayStats;

export interface PayOutlier {
  employeeId: number;
  fullName: string;
  jobTitle: string;
  salaryMinor: number;
  roleMedianMinor: number;
  /** Signed: positive above the role median, negative below. */
  differencePct: number;
  direction: 'above' | 'below';
}

export interface CountryJobTitles {
  country: CountryRef;
  /** Highest median first. */
  jobTitles: JobTitlePay[];
  /** Largest gap from the role median first. */
  outliers: PayOutlier[];
}

/** What the raise simulator is asked: a group, chosen like the directory's list, and a percentage. */
export interface RaiseSimulationRequest {
  filters: Record<string, string>;
  pct: number;
}

/** What a raise costs for the people paid in one currency. Every amount is in that currency. */
export interface CurrencyRaise {
  currency: string;
  headcount: number;
  currentTotalMinor: number;
  increaseMinor: number;
  newTotalMinor: number;
}

export interface RaiseSimulation {
  /** How many employees the filters matched. */
  headcount: number;
  /** In order of currency code. */
  byCurrency: CurrencyRaise[];
  /** Indicative: converted with the fixed FX table named by fxTableVersion. */
  increaseUsdMinor: number;
  fxTableVersion: string;
}

export interface ApiFieldIssue {
  path: string;
  message: string;
}

/** An error response from the API, in its standard `{ error: { code, message, fields? } }` shape. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: ApiFieldIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: ApiFieldIssue[] };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  params?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // An absolute URL, because not every runtime that runs this code resolves relative ones.
  const url = new URL(path, window.location.origin);
  url.search = new URLSearchParams(options.params ?? {}).toString();

  const hasBody = options.body !== undefined;
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new ApiError(
      response.status,
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.message ?? FALLBACK_MESSAGE,
      body.error?.fields,
    );
  }
  // 204 No Content, as DELETE answers.
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const EXPORT_CSV_PATH = '/api/employees/export.csv';

export const api = {
  getEmployees: (params: Record<string, string>, signal?: AbortSignal): Promise<EmployeePage> =>
    request<EmployeePage>('/api/employees', { params, signal }),

  getEmployee: (id: number, signal?: AbortSignal): Promise<EmployeeDetail> =>
    request<EmployeeDetail>(`/api/employees/${id}`, { signal }),

  createEmployee: (body: unknown): Promise<Employee> =>
    request<Employee>('/api/employees', { method: 'POST', body }),

  updateEmployee: (id: number, body: unknown): Promise<Employee> =>
    request<Employee>(`/api/employees/${id}`, { method: 'PATCH', body }),

  changeSalary: (id: number, body: unknown): Promise<Employee> =>
    request<Employee>(`/api/employees/${id}/salary-changes`, { method: 'POST', body }),

  removeEmployee: (id: number): Promise<void> =>
    request<undefined>(`/api/employees/${id}`, { method: 'DELETE' }),

  getMeta: (signal?: AbortSignal): Promise<Meta> => request<Meta>('/api/meta', { signal }),

  getInsightsSummary: (signal?: AbortSignal): Promise<InsightsSummary> =>
    request<InsightsSummary>('/api/insights/summary', { signal }),

  getInsightsCountries: (signal?: AbortSignal): Promise<CountryPay[]> =>
    request<CountryPay[]>('/api/insights/countries', { signal }),

  /** A POST because the question has a body. It is read-only: nothing is saved. */
  simulateRaise: (body: RaiseSimulationRequest, signal?: AbortSignal): Promise<RaiseSimulation> =>
    request<RaiseSimulation>('/api/simulations/raise', { method: 'POST', body, signal }),

  getCountryJobTitles: (countryCode: string, signal?: AbortSignal): Promise<CountryJobTitles> =>
    request<CountryJobTitles>(`/api/insights/countries/${countryCode}/job-titles`, { signal }),
};
