import {
  EMPLOYEE_SORT_FIELDS,
  type EmployeeSortField,
  SORT_ORDERS,
  type SortOrder,
} from '@salary-manager/shared';
import { EXPORT_CSV_PATH } from '../api/client';

/** Everything the directory shows is decided by this, and all of it lives in the URL. */
export interface DirectoryQuery {
  search: string;
  country: string;
  department: string;
  jobTitle: string;
  sort: EmployeeSortField;
  order: SortOrder;
  page: number;
}

export const PAGE_SIZE = 25;

const DEFAULTS: DirectoryQuery = {
  search: '',
  country: '',
  department: '',
  jobTitle: '',
  sort: 'name',
  order: 'asc',
  page: 1,
};

function oneOf<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/** Reads the URL. Anything missing or not understood falls back to its default. */
export function parseDirectoryQuery(params: URLSearchParams): DirectoryQuery {
  const page = Number(params.get('page'));
  return {
    search: params.get('search') ?? DEFAULTS.search,
    country: params.get('country') ?? DEFAULTS.country,
    department: params.get('department') ?? DEFAULTS.department,
    jobTitle: params.get('jobTitle') ?? DEFAULTS.jobTitle,
    sort: oneOf(EMPLOYEE_SORT_FIELDS, params.get('sort'), DEFAULTS.sort),
    order: oneOf(SORT_ORDERS, params.get('order'), DEFAULTS.order),
    page: Number.isInteger(page) && page >= 1 ? page : DEFAULTS.page,
  };
}

/** Writes the URL, leaving out empty values and defaults so links stay short. */
export function toUrlParams(query: DirectoryQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.search.trim() !== '') params.search = query.search.trim();
  if (query.country !== '') params.country = query.country;
  if (query.department !== '') params.department = query.department;
  if (query.jobTitle !== '') params.jobTitle = query.jobTitle;
  if (query.sort !== DEFAULTS.sort) params.sort = query.sort;
  if (query.order !== DEFAULTS.order) params.order = query.order;
  if (query.page !== DEFAULTS.page) params.page = String(query.page);
  return params;
}

export function toApiParams(query: DirectoryQuery): Record<string, string> {
  return { ...toUrlParams(query), pageSize: String(PAGE_SIZE) };
}

/** The export takes the same search, filters and sort, and is never paginated. */
export function exportCsvHref(query: DirectoryQuery): string {
  const params = new URLSearchParams(toUrlParams({ ...query, page: DEFAULTS.page })).toString();
  return params === '' ? EXPORT_CSV_PATH : `${EXPORT_CSV_PATH}?${params}`;
}

export function withoutFilters(query: DirectoryQuery): DirectoryQuery {
  return { ...query, search: '', country: '', department: '', jobTitle: '', page: 1 };
}

export function hasActiveFilters(query: DirectoryQuery): boolean {
  return [query.search.trim(), query.country, query.department, query.jobTitle].some(
    (value) => value !== '',
  );
}

/** Clicking the current sort column reverses it; clicking another starts it ascending. */
export function sortedBy(
  query: DirectoryQuery,
  column: EmployeeSortField,
): Partial<DirectoryQuery> {
  const reverses = query.sort === column && query.order === 'asc';
  return { sort: column, order: reverses ? 'desc' : 'asc' };
}

/** The first and last row numbers on a page, for "Showing 26–50 of 1,240". */
export function shownRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number } {
  return { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total) };
}
