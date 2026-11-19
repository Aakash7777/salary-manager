import { ApiError, type ApiFieldIssue, type Employee } from '../api/client';

/** The calendar date on the user's own clock, as YYYY-MM-DD. This is "today" for the forms. */
export function localIsoDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Removes fields the user left empty, so the shared schema reports them as "required"
 * instead of judging an empty string as a malformed value.
 */
export function withoutBlanks(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        !(typeof value === 'string' && value.trim() === ''),
    ),
  );
}

/** One message per field, the first reported, keyed the way the form names its fields. */
export function fieldErrorsFrom(issues: ApiFieldIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    errors[issue.path] ??= issue.message;
  }
  return errors;
}

export const DETAIL_FIELDS = [
  'fullName',
  'email',
  'jobTitle',
  'department',
  'countryCode',
  'employmentType',
  'hireDate',
] as const;

export type DetailField = (typeof DETAIL_FIELDS)[number];
export type DetailValues = Record<DetailField, string>;

function comparable(field: DetailField, value: string): string {
  const trimmed = value.trim();
  return field === 'email' ? trimmed.toLowerCase() : trimmed;
}

/**
 * The detail fields whose value really differs from the stored one. Spaces around text and
 * the letter case of an email are ignored, because the server would ignore them too.
 */
export function changedDetails(
  original: DetailValues,
  values: DetailValues,
): Partial<DetailValues> {
  const changed: Partial<DetailValues> = {};
  for (const field of DETAIL_FIELDS) {
    if (comparable(field, values[field]) !== comparable(field, original[field])) {
      changed[field] = values[field];
    }
  }
  return changed;
}

/** What every employee form holds. Each form uses the fields it needs and ignores the rest. */
export interface EmployeeFormValues {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  employmentType: string;
  hireDate: string | null;
  /** Add employee only. */
  salaryMajor: number | string;
  /** Edit details only, and only when the country changes. */
  newSalaryMajor: number | string;
  reason: string;
}

export const EMPTY_EMPLOYEE_FORM: EmployeeFormValues = {
  fullName: '',
  email: '',
  jobTitle: '',
  department: '',
  countryCode: '',
  employmentType: 'FULL_TIME',
  hireDate: null,
  salaryMajor: '',
  newSalaryMajor: '',
  reason: '',
};

export function detailValuesOf(source: Employee | EmployeeFormValues): DetailValues {
  return {
    fullName: source.fullName,
    email: source.email,
    jobTitle: source.jobTitle,
    department: source.department,
    countryCode: source.countryCode,
    employmentType: source.employmentType,
    hireDate: source.hireDate ?? '',
  };
}

export interface ServerErrorOutcome {
  /** Problems to show under their inputs. */
  fieldErrors: Record<string, string>;
  /** A message to show as a notification, when the problem belongs to no field. */
  notice: string | null;
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/** Decides where a failed save is shown: under a field where possible, otherwise as a notice. */
export function serverErrorOutcome(error: unknown): ServerErrorOutcome {
  if (error instanceof ApiError && error.status === 409) {
    return { fieldErrors: { email: error.message }, notice: null };
  }
  if (error instanceof ApiError && error.status === 400) {
    const fieldErrors = fieldErrorsFrom(error.fields.filter((issue) => issue.path !== ''));
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors, notice: null };
    }
  }
  return {
    fieldErrors: {},
    notice: error instanceof Error ? error.message : FALLBACK_MESSAGE,
  };
}
