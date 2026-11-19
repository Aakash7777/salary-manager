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

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

async function getJson<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  // An absolute URL, because not every runtime that runs this code resolves relative ones.
  const url = new URL(path, window.location.origin);
  url.search = new URLSearchParams(params).toString();

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new ApiError(
      response.status,
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.message ?? FALLBACK_MESSAGE,
      body.error?.fields,
    );
  }
  return (await response.json()) as T;
}

export const EXPORT_CSV_PATH = '/api/employees/export.csv';

export const api = {
  getEmployees: (params: Record<string, string>, signal?: AbortSignal): Promise<EmployeePage> =>
    getJson<EmployeePage>('/api/employees', params, signal),

  getMeta: (signal?: AbortSignal): Promise<Meta> => getJson<Meta>('/api/meta', {}, signal),
};
